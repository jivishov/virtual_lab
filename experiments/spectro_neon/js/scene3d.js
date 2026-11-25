// scene3d.js - Photorealistic Three.js WebGL2 Native-MSAA PBR Engine for Blender 5.2 GLB Lab Assets
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import * as config from './config.js';
import { getState, findObjectById } from './state.js';

let containerEl = null;
let labelsOverlayEl = null;
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let clock = null;
let rafId = null;

// Cycles-baked grounded benchtop ambient occlusion uniform (clean satin Durcon epoxy, zero wet-mirror artifacts!)
const opticalUniforms = {
    uBenchAO: { value: null },
    uHasBenchBake: { value: 0.0 },
};

// Grounded contact shadow, glass caustic & soft radial step-beacon textures
const decalTextures = {
    shadowRound: null,
    shadowRect: null,
    caustic: null,
    highlightRing: null,
};

// Loaded asset instances indexed by logical lab object ID
const objects3D = new Map();
const pickTargets = []; // Invisible ergonomic hit volumes + direct clickable parts
const labelAnchors = new Map(); // id -> { el, localOffset: Vector3, getText: fn }
let labelsVisible = false;

// Back-to-front dynamically sorted transparent vessels (prevents cross-vessel glass/liquid sorting bugs!)
const transparentVessels = [];
const _sortCamPos = new THREE.Vector3();
const _sortObjPos = new THREE.Vector3();
const _pourMouthVec = new THREE.Vector3();

// Smooth animation state
const animState = {
    // Smoothly interpolated visual liquid fill ratios per object id
    fillRatios: new Map(),
    // Bottle cap open amounts (0 = closed, 1 = lifted aside)
    capOpen: new Map(),
    capHoverTarget: null,
    // Spec 20 hinged lid open amount (0 = closed, 1 = open)
    lidOpen: 0,
    lidTarget: 0,
    // Spec 20 button physical press timers
    btnPress: { zero: 0, measure: 0, mode: 0 },
    beamFlash: 0,
    // Active choreographed action animation (dip/dispense/pour/insert)
    activeChoreo: null,
    // Loaded pipette hover positions (poised right above source vessel so user goes straight to target without returning to stand!)
    loadedHoldPos: new Map(),
    // Camera flight tween
    cameraFlight: null,
    // Active drag override
    draggedId: null,
    dragWorldPos: new THREE.Vector3(),
    dropHoverId: null,
};

// Reusable fluid pour/dispense stream mesh
let pourStreamMesh = null;
let pourStreamMat = null;

// Spec 20 live LCD canvas texture
let specLcdCanvas = null;
let specLcdCtx = null;
let specLcdTexture = null;
let lastSpecDisplayKey = '';

// Shared highlight ring geometry
const ringGeoCache = new Map();

// ---------------------------------------------------------------------------
// Liquid Beer-Lambert Optical Style Helper (Premultiplied Linear-HDR Optics!)
// ---------------------------------------------------------------------------
// Analytical solutions use a physically-calibrated MeshPhysicalMaterial with
// premultiplied linear-HDR Beer-Lambert volumetric absorption + un-attenuated
// Fresnel specular reflections (eliminates milky diffuse haze on water/liquids
// AND avoids ANGLE/D3D11 HalfFloat16 transmission mipmap block artifacts!).

export function getLiquidOpticalStyle(concentration, isWaste = false, vesselThickness = 0.032) {
    // Optical path multiplier so wider bottles appear deeper than narrow 10mm cuvettes/pipettes
    const pathFactor = Math.max(0.62, Math.min(1.30, vesselThickness / 0.026));

    if (isWaste) {
        return {
            color: new THREE.Color(0x0c4a6e),
            emissive: new THREE.Color(0x031826),
            emissiveIntensity: 0.14,
            opacity: 0.54,
            meniscusOpacity: 0.44,
            roughness: 0.028,
            metalness: 0.0,
            envMapIntensity: 1.55,
        };
    }
    if (concentration === null || concentration === undefined) {
        return {
            color: new THREE.Color(0x1e4c64),
            emissive: new THREE.Color(0x02080d),
            emissiveIntensity: 0.04,
            opacity: 0.08,
            meniscusOpacity: 0.16,
            roughness: 0.016,
            metalness: 0.0,
            envMapIntensity: 1.85,
        };
    }
    if (concentration === -1) {
        // Unknown Drink — deep luminous jewel royal-amethyst translucent beverage
        return {
            color: new THREE.Color(0x5212b0),
            emissive: new THREE.Color(0x1c0446),
            emissiveIntensity: 0.24,
            opacity: Math.min(0.86, 0.70 * Math.pow(pathFactor, 0.45)),
            meniscusOpacity: 0.54,
            roughness: 0.018,
            metalness: 0.0,
            envMapIntensity: 1.65,
        };
    }

    const eff = Math.max(0, Math.min(concentration, config.STOCK_CONCENTRATION));
    const t = config.STOCK_CONCENTRATION > 0 ? eff / config.STOCK_CONCENTRATION : 0;

    // Distilled H2O (0 µM) -> crystal-clear colorless water with luminous refractive sheen & crisp meniscus!
    if (t < 0.005) {
        return {
            color: new THREE.Color(0xe6f7ff),
            emissive: new THREE.Color(0x1a3848),
            emissiveIntensity: 0.22,
            opacity: 0.14,
            meniscusOpacity: 0.44,
            roughness: 0.010,
            metalness: 0.0,
            envMapIntensity: 2.55,
            isClearWater: true,
        };
    }

    // Authentic FD&C Blue #1 (Brilliant Blue FCF, λmax = 630 nm) Beer-Lambert jewel gradient:
    // Pale crystalline aqua (2/8) -> sparkling cyan (4/6) -> cerulean (6/4) -> cobalt (8/2) -> deep sapphire (10/0)
    const perceived = Math.pow(t, 0.88);
    const diluteCol = new THREE.Color(0x28b8f4);
    const midCol = new THREE.Color(0x0474e2);
    const stockCol = new THREE.Color(0x002fa8);
    const col = perceived < 0.5
        ? diluteCol.clone().lerp(midCol, perceived / 0.5)
        : midCol.clone().lerp(stockCol, (perceived - 0.5) / 0.5);

    const diluteGlow = new THREE.Color(0x083454);
    const stockGlow = new THREE.Color(0x02185c);
    const emissive = diluteGlow.clone().lerp(stockGlow, perceived);

    // Physical Beer-Lambert exponential absorption: alpha = 1 - 10^(-k * c * b)
    const absorbanceEff = 0.86 * t * pathFactor;
    const baseOpacity = Math.max(0.18, Math.min(0.89, 1.0 - Math.pow(10, -absorbanceEff)));

    return {
        color: col,
        emissive,
        emissiveIntensity: 0.16 + 0.20 * perceived,
        opacity: baseOpacity,
        meniscusOpacity: Math.min(0.74, 0.24 + baseOpacity * 0.58),
        roughness: 0.015,
        metalness: 0.0,
        envMapIntensity: 1.80,
        isClearWater: false,
    };
}

// ---------------------------------------------------------------------------
// Node Lookup & Photorealistic PBR Material Enhancement for Blender 5.2 GLBs
// ---------------------------------------------------------------------------

function findNodeByPrefix(root, prefix) {
    let found = null;
    root.traverse((child) => {
        if (found) return;
        if (
            child.name === prefix ||
            child.name.startsWith(prefix + '.') ||
            child.name.startsWith(prefix + '_')
        ) {
            found = child;
        }
    });
    return found;
}

function findExactOrDotNode(root, baseName) {
    // Three.js GLTFLoader sanitizes Blender's '.001' suffixes to '001' (stripping the dot)
    const re = new RegExp(`^${baseName}(?:[._]?\\d+)?$`);
    let found = null;
    root.traverse((child) => {
        if (found) return;
        if (re.test(child.name)) {
            found = child;
        }
    });
    return found;
}

// Helper to inject calibrated optical shading into MeshPhysicalMaterial (native 4x MSAA + AgX tonemapping!)
function patchLinearOpticalShader(mat, cacheKey, extraUniformDecl, glslBody, extraUniforms = {}) {
    mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, extraUniforms);
        if (extraUniformDecl) {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>\n${extraUniformDecl}`
            );
        }
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', glslBody);
    };
    mat.customProgramCacheKey = () => cacheKey;
    return mat;
}

// Patch BenchTop (`Mat_EpoxyBench`) with authentic velvety matte-satin Durcon phenolic resin & deep Cycles contact AO
// (Eliminates washed-out glossy mirror glare so glassware & solid instruments look grounded and photorealistic!)
function patchBenchPhotorealShader(mat) {
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uBenchAO = opticalUniforms.uBenchAO;
        shader.uniforms.uHasBenchBake = opticalUniforms.uHasBenchBake;

        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vBenchWorldPos;')
            .replace(
                '#include <worldpos_vertex>',
                '#include <worldpos_vertex>\nvec4 benchWp = modelMatrix * vec4(transformed, 1.0);\nvBenchWorldPos = benchWp.xyz;'
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>
                varying vec3 vBenchWorldPos;
                uniform sampler2D uBenchAO;
                uniform float uHasBenchBake;`
            )
            .replace(
                '#include <roughnessmap_fragment>',
                `#include <roughnessmap_fragment>
                // Authentic matte-satin Durcon phenolic laboratory tabletop (kills broad glossy mirror glare!)
                roughnessFactor = clamp(mix(roughnessFactor, 0.87, 0.72), 0.74, 0.96);`
            )
            .replace(
                '#include <lights_fragment_end>',
                `#include <lights_fragment_end>
                if (uHasBenchBake > 0.5 && vBenchWorldPos.y > -0.012) {
                    vec2 bUV = vec2((vBenchWorldPos.x + 1.25) / 2.50, (-vBenchWorldPos.z + 0.48) / 1.03);
                    // Taper cleanly before rear cove lip so no hard dark stripe appears along backsplash join
                    float bMask = smoothstep(0.0, 0.05, bUV.x) * smoothstep(1.0, 0.95, bUV.x)
                                * smoothstep(0.0, 0.05, bUV.y) * smoothstep(0.985, 0.89, bUV.y);
                    vec2 bUVc = clamp(bUV, 0.001, 0.999);
                    float rawAO = texture2D(uBenchAO, bUVc).r;
                    float benchAO = mix(1.0, pow(max(clamp(rawAO, 0.0, 1.0), 0.0001), 1.26), bMask);

                    // Subtle physical horizon occlusion from rear wall/shelf for grounded laboratory depth
                    float rearWallShade = 1.0 - smoothstep(0.50, 0.96, bUV.y) * 0.34;

                    // Rich velvety Durcon matte-charcoal phenolic resin with deep contact shadows & restrained satin specular
                    reflectedLight.indirectDiffuse *= mix(0.06, 1.0, benchAO) * rearWallShade;
                    reflectedLight.indirectSpecular *= 0.32 * mix(0.08, 1.0, benchAO) * mix(0.70, 1.0, rearWallShade);
                    reflectedLight.directDiffuse *= mix(0.16, 1.0, benchAO);
                    reflectedLight.directSpecular *= 0.22 * mix(0.10, 1.0, benchAO);
                }`
            );
    };
    mat.customProgramCacheKey = () => 'epoxy_bench_matte_durcon_v9';
    return mat;
}

// Patch Subway Tile Backsplash (`Mat_LabSubwayTile`) with natural architectural porcelain glaze & shelf shadow depth
function patchTileBacksplashGIShader(mat) {
    mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vTileWorldPos;')
            .replace(
                '#include <worldpos_vertex>',
                '#include <worldpos_vertex>\nvec4 tileWp = modelMatrix * vec4(transformed, 1.0);\nvTileWorldPos = tileWp.xyz;'
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>
                varying vec3 vTileWorldPos;`
            )
            .replace(
                '#include <lights_fragment_end>',
                `#include <lights_fragment_end>
                {
                    // Natural porcelain ceramic luminance falloff without blowing out whites
                    float yNorm = clamp((vTileWorldPos.y - 0.085) / 0.295, 0.0, 1.0);
                    float underShelfGlow = smoothstep(0.46, 0.98, yNorm);
                    float topLipShadow = 1.0 - smoothstep(0.95, 1.0, yNorm) * 0.18;
                    float racewayUnderAO = 1.0 - exp(-pow((vTileWorldPos.y - 0.168) / 0.022, 2.0)) * 0.15;
                    vec3 warmWash = mix(vec3(0.98, 0.99, 1.01), vec3(1.09, 1.07, 1.03), underShelfGlow);
                    float archMod = topLipShadow * racewayUnderAO;
                    reflectedLight.indirectDiffuse *= warmWash * archMod;
                    reflectedLight.directDiffuse *= mix(vec3(0.98), warmWash, 0.60) * archMod;
                }`
            );
    };
    mat.customProgramCacheKey = () => 'subway_tile_architectural_v8';
    return mat;
}

function makeBorosilicateGlassMat(variant = 'clear') {
    if (variant === 'displayGlass') {
        // Ultra-clear anti-reflective optical cover glass over Spectronic 20D+ recessed 7-segment LCD
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0xf4fbf8,
            transparent: true,
            opacity: 0.04,
            roughness: 0.018,
            metalness: 0.0,
            ior: 1.51,
            specularIntensity: 0.72,
            clearcoat: 1.0,
            clearcoatRoughness: 0.016,
            envMapIntensity: 0.85,
            depthWrite: false,
            side: THREE.FrontSide,
        });
        return patchLinearOpticalShader(
            mat,
            'spec20_display_cover_glass_v7',
            '',
            `
            float dNdv = saturate(abs(dot(geometryNormal, geometryViewDir)));
            float dFres = 0.02 + 0.98 * pow(max(1.0 - dNdv, 0.0001), 4.8);
            vec3 dSpec = totalSpecular;
            #ifdef USE_CLEARCOAT
                dSpec += (clearcoatSpecularDirect + clearcoatSpecularIndirect) * material.clearcoat;
            #endif
            dSpec = clamp(dSpec, 0.0, 4.0);
            float dPeak = max(dSpec.r, max(dSpec.g, dSpec.b));
            float dAlpha = clamp(0.008 + dFres * 0.13 + dPeak * 0.09, 0.008, 0.22);
            gl_FragColor = vec4(dSpec * (0.22 + 0.45 * dFres) / max(dAlpha, 0.30), dAlpha);
            `
        );
    }

    if (variant === 'frosted') {
        // Ground-glass lab stopper / frosted glass surface (native MSAA, soft translucent quartz diffusion!)
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0xeaf2f7,
            transparent: true,
            opacity: 0.56,
            roughness: 0.40,
            metalness: 0.0,
            ior: 1.49,
            specularIntensity: 0.90,
            clearcoat: 0.15,
            clearcoatRoughness: 0.36,
            envMapIntensity: 1.15,
            depthWrite: false,
            side: THREE.FrontSide,
        });
        return patchLinearOpticalShader(
            mat,
            'borosilicate_frosted_msaa_v6',
            '',
            `
            float fNdv = saturate(abs(dot(geometryNormal, geometryViewDir)));
            float fRim = pow(max(1.0 - fNdv, 0.0001), 2.4);
            vec3 fSpec = totalSpecular;
            #ifdef USE_CLEARCOAT
                fSpec += (clearcoatSpecularDirect + clearcoatSpecularIndirect) * material.clearcoat;
            #endif
            fSpec = clamp(fSpec, 0.0, 6.0);
            float fAlpha = clamp(0.42 + fRim * 0.34, 0.36, 0.84);
            vec3 fBody = totalDiffuse * 0.72 + vec3(0.14, 0.17, 0.20) * (0.35 + 0.55 * fRim);
            gl_FragColor = vec4(clamp(fBody + fSpec * 0.55, 0.0, 6.0), fAlpha);
            `
        );
    }

    if (variant === 'acrylic') {
        // Laser-cut crystal-clear PMMA acrylic pipette stand (crisp beveled silver-aqua edges, full MSAA!)
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0xf0f9fc,
            transparent: true,
            opacity: 0.20,
            roughness: 0.028,
            metalness: 0.0,
            ior: 1.49,
            specularIntensity: 1.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
            envMapIntensity: 1.65,
            depthWrite: false,
            side: THREE.FrontSide,
        });
        return patchLinearOpticalShader(
            mat,
            'pmma_acrylic_msaa_v6',
            '',
            `
            float aNdv = saturate(abs(dot(geometryNormal, geometryViewDir)));
            float aFres = 0.04 + 0.96 * pow(max(1.0 - aNdv, 0.0001), 3.2);
            float aEdge = pow(max(1.0 - aNdv, 0.0001), 4.2);
            vec3 aSpec = totalSpecular;
            #ifdef USE_CLEARCOAT
                aSpec += (clearcoatSpecularDirect + clearcoatSpecularIndirect) * material.clearcoat;
            #endif
            aSpec = clamp(aSpec, 0.0, 6.0);
            float aPeak = max(aSpec.r, max(aSpec.g, aSpec.b));
            float aAlpha = clamp(0.10 + aFres * 0.36 + aEdge * 0.26 + aPeak * 0.36, 0.10, 0.86);
            vec3 aTint = vec3(0.68, 0.84, 0.90) * (0.14 + 0.42 * aEdge);
            vec3 aFinal = aTint + aSpec * (0.58 + 0.75 * aFres) / max(aAlpha, 0.24);
            gl_FragColor = vec4(clamp(aFinal, 0.0, 8.0), aAlpha);
            `
        );
    }

    if (variant === 'amber') {
        // Authentic borosilicate amber reagent bottles on upper lab shelf (rich translucent honey-amber glass)
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0x8a3406,
            emissive: new THREE.Color(0x280c02),
            emissiveIntensity: 0.20,
            transparent: true,
            opacity: 0.88,
            roughness: 0.030,
            metalness: 0.0,
            ior: 1.50,
            specularIntensity: 1.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
            envMapIntensity: 1.55,
            depthWrite: true,
            side: THREE.FrontSide,
        });
        return patchLinearOpticalShader(
            mat,
            'borosilicate_amber_v6',
            '',
            `
            float amNdv = saturate(abs(dot(geometryNormal, geometryViewDir)));
            float amEdge = pow(max(1.0 - amNdv, 0.0001), 2.2);
            vec3 amBody = mix(diffuseColor.rgb * 0.92 + totalEmissiveRadiance, diffuseColor.rgb * 0.22, amEdge * 0.76);
            vec3 amSpec = totalSpecular;
            #ifdef USE_CLEARCOAT
                amSpec += (clearcoatSpecularDirect + clearcoatSpecularIndirect) * material.clearcoat;
            #endif
            gl_FragColor = vec4(clamp(amBody + amSpec * 0.78, 0.0, 8.0), clamp(0.84 + amEdge * 0.14, 0.82, 0.98));
            `
        );
    }

    // Crystal-Clear Schott / Pyrex 3.3 Borosilicate Laboratory Glass (Native 4x Hardware MSAA!)
    // Preserves crisp multi-layer glass transparency (bottles, 6 test tubes, beaker, pipettes, cuvette)
    // with luminous studio window reflections, delicate Schott sea-green rim contour & ZERO blackening!
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0xf4fbfc,
        transparent: true,
        opacity: 0.08,
        roughness: 0.014,
        metalness: 0.0,
        ior: 1.47,
        specularIntensity: 1.0,
        specularColor: new THREE.Color(0xffffff),
        clearcoat: 0.80,
        clearcoatRoughness: 0.010,
        envMapIntensity: 2.25,
        depthWrite: false,
        side: THREE.FrontSide,
    });
    return patchLinearOpticalShader(
        mat,
        'borosilicate_clear_msaa_v8',
        '',
        `
        float bNdv = saturate(abs(dot(geometryNormal, geometryViewDir)));
        float bFres = 0.042 + 0.958 * pow(max(1.0 - bNdv, 0.0001), 3.1);
        float bRim = pow(max(1.0 - bNdv, 0.0001), 4.0);
        vec3 bSpec = totalSpecular;
        #ifdef USE_CLEARCOAT
            bSpec += (clearcoatSpecularDirect + clearcoatSpecularIndirect) * material.clearcoat;
        #endif
        bSpec = clamp(bSpec, 0.0, 9.5);
        float specPeak = max(bSpec.r, max(bSpec.g, bSpec.b));

        // Crystal clear interior -> crisp silvery Pyrex wall edges & sparkling studio windowpane glints!
        float bAlpha = clamp(0.052 + bFres * 0.42 + bRim * 0.30 + specPeak * 0.48, 0.052, 0.93);
        vec3 pyrexWall = mix(vec3(0.90, 0.96, 0.98), vec3(0.68, 0.84, 0.86), bRim) * (0.09 + 0.30 * bFres + 0.22 * bRim);
        vec3 specContrib = bSpec * (0.68 + 0.92 * bFres) / max(bAlpha, 0.22);
        gl_FragColor = vec4(clamp(pyrexWall + specContrib, 0.0, 9.5), bAlpha);
        `
    );
}

function makeDynamicLiquidMat(style) {
    const clearUniform = { value: style.isClearWater ? 1.0 : 0.0 };
    const mat = new THREE.MeshPhysicalMaterial({
        color: style.color.clone(),
        emissive: style.emissive.clone(),
        emissiveIntensity: style.emissiveIntensity ?? 0.14,
        transparent: true,
        opacity: style.opacity ?? 0.60,
        roughness: style.roughness ?? 0.016,
        metalness: 0.0,
        ior: 1.333,
        specularIntensity: 1.0,
        clearcoat: 0.0,
        envMapIntensity: style.envMapIntensity ?? 1.45,
        depthWrite: false,
        side: THREE.FrontSide,
    });
    mat.userData.uIsClearWater = clearUniform;
    // Pure Linear-HDR Volumetric Beer-Lambert Liquid Shader + Luminous Clear-Water Cylindrical Refraction!
    return patchLinearOpticalShader(
        mat,
        'beer_lambert_liquid_hdr_v6',
        'uniform float uIsClearWater;',
        `
        float lNdv = saturate(abs(dot(geometryNormal, geometryViewDir)));
        float lEdge = pow(max(1.0 - lNdv, 0.0001), 2.1);
        float lRim = pow(max(1.0 - lNdv, 0.0001), 4.2);
        vec3 lSpec = clamp(totalSpecular, 0.0, 8.5);

        if (uIsClearWater > 0.5) {
            // Distilled H2O (0 uM): zero Beer-Lambert dye absorption -> bright studio tile/sky cylindrical refraction!
            // Prevents dark rear cove from turning clear water bottle into smoky charcoal gray!
            float wRefr = pow(max(1.0 - lNdv, 0.0001), 1.65);
            float wCore = 0.26 + 0.56 * lNdv;
            vec3 wTileBounce = vec3(0.76, 0.86, 0.91) * (0.28 * wCore + 0.62 * wRefr);
            vec3 wCausticRim = vec3(0.92, 0.98, 1.0) * (0.48 * lRim);
            float wAlpha = clamp(0.18 + 0.34 * wRefr + 0.26 * lRim + max(lSpec.r, max(lSpec.g, lSpec.b)) * 0.20, 0.16, 0.78);
            vec3 wColor = wTileBounce + wCausticRim + lSpec * (0.42 + 0.65 * lEdge) / max(wAlpha, 0.32);
            gl_FragColor = vec4(clamp(wColor, 0.0, 8.5), wAlpha);
        } else {
            float lBaseLum = max(0.004, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
            float lDiffLum = dot(totalDiffuse, vec3(0.2126, 0.7152, 0.0722));
            float lStudioMod = clamp(lDiffLum / lBaseLum, 0.35, 1.05);
            vec3 lCenter = diffuseColor.rgb * (0.64 + 0.34 * lStudioMod) + totalEmissiveRadiance * 0.85;
            vec3 lEdgeCol = diffuseColor.rgb * 0.24;
            vec3 lBody = mix(lCenter, lEdgeCol, lEdge * 0.72);
            float lAlpha = clamp(diffuseColor.a * (0.94 + 0.28 * lEdge) + lRim * 0.10, 0.018, 0.94);
            gl_FragColor = vec4(clamp(lBody + lSpec * (0.22 + 0.78 * lEdge) / max(lAlpha, 0.28) * 0.32, 0.0, 8.0), lAlpha);
        }
        `,
        { uIsClearWater: clearUniform }
    );
}

function makeMeniscusMat(style) {
    const clearUniform = { value: style.isClearWater ? 1.0 : 0.0 };
    // Concave capillary air-liquid meniscus: linear HDR with realistic IOR 1.333 grazing highlight!
    const mat = new THREE.MeshPhysicalMaterial({
        color: style.color.clone(),
        emissive: style.emissive.clone(),
        emissiveIntensity: (style.emissiveIntensity ?? 0.10) * 0.50,
        transparent: true,
        opacity: style.meniscusOpacity ?? 0.36,
        roughness: 0.018,
        metalness: 0.0,
        ior: 1.333,
        specularIntensity: 1.0,
        clearcoat: 0.0,
        envMapIntensity: 1.55,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    mat.userData.uIsClearWater = clearUniform;
    return patchLinearOpticalShader(
        mat,
        'beer_lambert_meniscus_hdr_v6',
        'uniform float uIsClearWater;',
        `
        float mNdv = saturate(abs(dot(geometryNormal, geometryViewDir)));
        float mRim = pow(max(1.0 - mNdv, 0.0001), 2.5);
        vec3 mSpec = clamp(totalSpecular, 0.0, 8.0) * (0.18 + 0.82 * mRim);
        if (uIsClearWater > 0.5) {
            // Sparkling bright capillary silver-aqua water surface meniscus (clearly visible in Blank 0/10 tube & H2O bottle!)
            vec3 mWater = vec3(0.84, 0.94, 0.98) * (0.42 + 0.52 * mRim);
            float mWAlpha = clamp(0.28 + mRim * 0.44, 0.22, 0.80);
            gl_FragColor = vec4(clamp(mWater + mSpec * 0.72, 0.0, 8.5), mWAlpha);
        } else {
            vec3 mBody = diffuseColor.rgb * (0.44 + 0.18 * mRim) + totalEmissiveRadiance * 0.40;
            float mAlpha = clamp(diffuseColor.a * 0.46 + mRim * 0.26, 0.030, 0.74);
            gl_FragColor = vec4(clamp(mBody + mSpec * 0.55, 0.0, 8.0), mAlpha);
        }
        `,
        { uIsClearWater: clearUniform }
    );
}

function applyMaxAnisotropy(mat) {
    if (!mat || !renderer) return;
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 4);
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
        if (mat[key]) {
            mat[key].anisotropy = maxAniso;
            mat[key].needsUpdate = true;
        }
    }
}

function sanitizeMeshGeometry(geo) {
    if (!geo || !geo.attributes) return;
    // Strip or repair any NaN/Inf/zero-length tangents or normals (prevents ANGLE/D3D11 NaN bloom corruption!)
    const tan = geo.attributes.tangent;
    if (tan && tan.array) {
        const arr = tan.array;
        let hasBad = false;
        for (let i = 0; i < arr.length; i += 4) {
            const x = arr[i], y = arr[i + 1], z = arr[i + 2];
            const lenSq = x * x + y * y + z * z;
            if (!Number.isFinite(lenSq) || lenSq < 1e-6) {
                hasBad = true;
                break;
            }
        }
        if (hasBad) {
            geo.deleteAttribute('tangent');
        }
    }
    const norm = geo.attributes.normal;
    if (norm && norm.array) {
        const arr = norm.array;
        let fixed = false;
        for (let i = 0; i < arr.length; i += 3) {
            const x = arr[i], y = arr[i + 1], z = arr[i + 2];
            const lenSq = x * x + y * y + z * z;
            if (!Number.isFinite(lenSq) || lenSq < 1e-6) {
                arr[i] = 0;
                arr[i + 1] = 1;
                arr[i + 2] = 0;
                fixed = true;
            }
        }
        if (fixed) norm.needsUpdate = true;
    }
}

function enhanceLoadedAssetMaterials(root, options = {}) {
    const vesselThickness = options.vesselThickness ?? 0.032;
    const liquidStyle = options.liquidStyle || getLiquidOpticalStyle(0, false, vesselThickness);
    const sharedLiquidMat = options.hasDynamicLiquid ? makeDynamicLiquidMat(liquidStyle) : null;
    const sharedMeniscusMat = options.hasDynamicLiquid ? makeMeniscusMat(liquidStyle) : null;
    const clearGlassMat = makeBorosilicateGlassMat('clear');
    const frostedGlassMat = makeBorosilicateGlassMat('frosted');
    const acrylicGlassMat = makeBorosilicateGlassMat('acrylic');
    const displayGlassMat = makeBorosilicateGlassMat('displayGlass');
    const amberGlassMat = makeBorosilicateGlassMat('amber');
    const trackedTransMeshes = [];

    root.traverse((obj) => {
        if (!obj.isMesh) return;
        sanitizeMeshGeometry(obj.geometry);
        const name = obj.name || '';
        const matName = Array.isArray(obj.material)
            ? obj.material.map((m) => m?.name || '').join(' ')
            : (obj.material?.name || '');

        obj.castShadow = true;
        obj.receiveShadow = true;

        // 0. Spectronic 20D+ Anti-Glare Optical Display Cover Glass Pane!
        if (name.startsWith('DetailV4_DisplayGlass') || matName.includes('DisplayGlass')) {
            obj.material = displayGlassMat;
            obj.renderOrder = 22;
            obj.castShadow = false;
            obj.receiveShadow = false;
            return;
        }

        // 1. Dynamic Liquid Meshes (Linear-HDR Beer-Lambert Optics)
        if (
            sharedLiquidMat &&
            (name.startsWith('LiquidBody') ||
                name.startsWith('LiquidBottom') ||
                name.startsWith('LiquidColumn') ||
                name.startsWith('LiquidStem') ||
                name.startsWith('LiquidTip') ||
                name.startsWith('LiquidMeniscus'))
        ) {
            const isMen = name.startsWith('LiquidMeniscus');
            obj.material = isMen ? sharedMeniscusMat : sharedLiquidMat;
            obj.renderOrder = isMen ? 11 : 10;
            obj.castShadow = false;
            obj.receiveShadow = false;
            trackedTransMeshes.push({ mesh: obj, layer: isMen ? 1 : 0 });
            return;
        }

        // 2. Background Wall Shelf Erlenmeyer Flask Liquid (translucent emerald-teal indicator!)
        if (name.includes('ShelfFlaskLiq')) {
            obj.material = makeDynamicLiquidMat({
                color: new THREE.Color(0x058074),
                emissive: new THREE.Color(0x012624),
                emissiveIntensity: 0.14,
                opacity: 0.64,
                roughness: 0.02,
                envMapIntensity: 1.65,
            });
            obj.renderOrder = 10;
            obj.castShadow = false;
            obj.receiveShadow = false;
            return;
        }

        // 3. Cuvette Residue Film (subtle wet blue cling at bottom of dirty cuvette awaiting rinse!)
        if (name.startsWith('ResidueFilm')) {
            obj.material = makeDynamicLiquidMat({
                color: new THREE.Color(0x0284c7),
                emissive: new THREE.Color(0x012642),
                emissiveIntensity: 0.10,
                opacity: 0.28,
                roughness: 0.05,
                envMapIntensity: 1.55,
            });
            obj.renderOrder = 13;
            obj.visible = false;
            obj.castShadow = false;
            obj.receiveShadow = false;
            trackedTransMeshes.push({ mesh: obj, layer: 3 });
            return;
        }

        // 4. Printed Paper Labels, Kimwipes Box, Calibration Sticker, Sharpie Barrel & Spec Dial Scale
        if (
            name.startsWith('BottleLabel') ||
            name.includes('DialScale') ||
            name.includes('AmberLabel') ||
            name.includes('WashBottleLabel') ||
            name.includes('KimwipesBox') ||
            name.startsWith('DetailV4_CalSticker') ||
            name.includes('SharpieBarrel')
        ) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
                if (!m) return;
                m.transparent = false;
                if (!m.roughnessMap) {
                    m.roughness = name.includes('DialScale') ? 0.34 : (name.includes('SharpieBarrel') ? 0.42 : 0.68);
                }
                m.metalness = name.includes('DialScale') ? 0.24 : 0.0;
                m.envMapIntensity = 0.38;
                // Keep ink print rich & crisp under AgX instead of washed-out paper white
                if (m.color) m.color.multiplyScalar(0.84);
                applyMaxAnisotropy(m);
            });
            return;
        }

        // 5. Fired Ceramic Enamel Graduations & Pyrex Test Tube Marking Patches (render crisply OVER refracted glass!)
        if (
            name.startsWith('BeakerGraduations') ||
            name.startsWith('PipetteGraduations') ||
            name.startsWith('DetailV3_BottleScale') ||
            name.startsWith('DetailV4_TubeFrost') ||
            name.includes('GradCylScale')
        ) {
            if (obj.material) {
                obj.material.transparent = true;
                obj.material.depthWrite = false;
                obj.material.alphaTest = 0.04;
                obj.material.roughness = name.startsWith('DetailV4_TubeFrost') ? 0.56 : 0.34;
                if (name.startsWith('DetailV4_TubeFrost')) {
                    obj.material.opacity = 0.24;
                }
                obj.material.side = THREE.FrontSide;
                applyMaxAnisotropy(obj.material);
            }
            obj.renderOrder = 13;
            obj.castShadow = false;
            obj.receiveShadow = false;
            trackedTransMeshes.push({ mesh: obj, layer: 3 });
            return;
        }

        // 5b. Delicate Etched Ceramic 10 mL Calibration Ring on Test Tubes (subtle frosted glass etch!)
        if (name.startsWith('CalibrationMark')) {
            obj.material = new THREE.MeshStandardMaterial({
                color: 0xe6edf4,
                transparent: true,
                opacity: 0.56,
                roughness: 0.52,
                metalness: 0.0,
                depthWrite: false,
            });
            obj.renderOrder = 13;
            obj.castShadow = false;
            obj.receiveShadow = false;
            trackedTransMeshes.push({ mesh: obj, layer: 3 });
            return;
        }

        // 6. Amber Reagent Bottles on Background Lab Shelf (strictly bottles, NEVER labels!)
        if (matName.includes('AmberBottleGlass') || name.includes('AmberBottle')) {
            obj.material = amberGlassMat;
            obj.castShadow = false;
            return;
        }

        // 7. Borosilicate Glassware, Frosted Ground Stoppers & Laser-Cut PMMA Acrylic (Native 4x MSAA!)
        if (
            name.includes('GlassBody') ||
            name.startsWith('CuvetteGlass') ||
            name.includes('ShelfFlask') ||
            name.includes('VolFlaskStopper') ||
            name.includes('GradCylBase') ||
            name.includes('GradCylTube') ||
            name.startsWith('DetailV2_Thread') ||
            matName.includes('Glass') ||
            matName.includes('Acrylic') ||
            matName.includes('FrostedStopper')
        ) {
            if (Array.isArray(obj.material)) {
                obj.material = obj.material.map((m) =>
                    (m.name || '').includes('Frosted') ? frostedGlassMat : clearGlassMat
                );
            } else if (matName.includes('Frosted') || name.includes('VolFlaskStopper')) {
                obj.material = frostedGlassMat;
            } else if (matName.includes('Acrylic')) {
                obj.material = acrylicGlassMat;
            } else {
                obj.material = clearGlassMat;
            }
            obj.renderOrder = 12;
            obj.castShadow = false;
            obj.receiveShadow = false;
            trackedTransMeshes.push({ mesh: obj, layer: 2 });
            return;
        }

        // 8. Preserve Blender 5.2 PBR Maps, Wire Matte-Satin Durcon Bench + Rich Non-Pale Solid Materials (Glass Intact!)
        if (obj.material && !Array.isArray(obj.material)) {
            const m = obj.material;
            applyMaxAnisotropy(m);

            const enrichSolidColor = (satMul, lumMul) => {
                if (!m.color) return;
                if (m.map) {
                    m.color.multiplyScalar(lumMul);
                } else {
                    const hsl = { h: 0, s: 0, l: 0 };
                    m.color.getHSL(hsl);
                    m.color.setHSL(
                        hsl.h,
                        Math.min(1.0, hsl.s * satMul),
                        Math.max(0.03, Math.min(0.95, hsl.l * lumMul))
                    );
                }
            };

            if (matName.includes('EpoxyBench')) {
                // Deep velvety Durcon matte-satin phenolic resin (ZERO glossy plastic glare!)
                m.color.setRGB(0.24, 0.26, 0.29);
                m.roughness = 0.90;
                m.envMapIntensity = 0.20;
                if ('clearcoat' in m) {
                    m.clearcoat = 0.0;
                    m.clearcoatRoughness = 0.85;
                }
                if (m.normalScale) m.normalScale.set(0.98, 0.98);
                if (name === 'BenchTop') {
                    patchBenchPhotorealShader(m);
                }
            } else if (matName.includes('LabSubwayTile') || name.includes('TileBacksplash')) {
                m.envMapIntensity = 0.68;
                if (m.normalScale) m.normalScale.set(0.96, 0.96);
                patchTileBacksplashGIShader(m);
            } else if (matName.includes('white_plaster') || name.includes('LabBackWall') || name.includes('SideWall')) {
                m.envMapIntensity = 0.30;
                enrichSolidColor(1.04, 0.90);
            } else if (name.includes('KimwipeTissue') || name.includes('FoldedKimwipe')) {
                m.envMapIntensity = 0.30;
                enrichSolidColor(1.0, 0.92);
                if (m.normalScale) m.normalScale.set(0.65, 0.65);
            } else if (matName.includes('SpecShell') || name.includes('SpecUpperShell')) {
                m.envMapIntensity = 0.48;
                enrichSolidColor(1.12, 0.84);
                if (m.normalScale) m.normalScale.set(0.66, 0.66);
            } else if (matName.includes('Rubber') || name.includes('Bulb') || name.includes('Foot') || name.includes('Gasket') || name.includes('PowerCord')) {
                // Deep rich silicone/rubber pipette bulbs & gaskets (eliminates chalky pale pastel wash!)
                m.envMapIntensity = 0.30;
                if (!m.roughnessMap) m.roughness = Math.max(m.roughness ?? 0.56, 0.56);
                enrichSolidColor(1.30, 0.74);
                if (m.normalScale) m.normalScale.set(0.76, 0.76);
            } else if (matName.includes('CapBody') || matName.includes('Bottle') || matName.includes('SpecChassis') || name.includes('SharpieCap')) {
                // Saturated injection-molded polymer bottle caps & instrument chassis
                m.envMapIntensity = 0.46;
                enrichSolidColor(1.24, 0.80);
                if (m.normalScale) m.normalScale.set(0.64, 0.64);
            } else if (m.metalness > 0.5 || matName.includes('Steel') || matName.includes('Aluminum') || matName.includes('Raceway') || matName.includes('Chrome')) {
                m.envMapIntensity = 1.08;
                enrichSolidColor(1.04, 0.90);
            } else {
                // Test tube rack, pipette stand, cuvette holder & solid bench accessories
                m.envMapIntensity = 0.44;
                enrichSolidColor(1.12, 0.84);
            }
        }
    });

    if (options.trackSorting && trackedTransMeshes.length > 0) {
        transparentVessels.push({
            root: options.sortRoot || root,
            centerOffsetY: options.sortCenterY ?? 0.08,
            meshes: trackedTransMeshes,
        });
    }

    return { liquidMat: sharedLiquidMat, meniscusMat: sharedMeniscusMat };
}

function updateTransparentSortOrder() {
    if (!camera || transparentVessels.length === 0) return;
    _sortCamPos.copy(camera.position);

    for (let i = 0; i < transparentVessels.length; i++) {
        const v = transparentVessels[i];
        v.root.getWorldPosition(_sortObjPos);
        _sortObjPos.y += v.centerOffsetY;
        v.distSq = _sortCamPos.distanceToSquared(_sortObjPos);
    }

    // Farthest vessels draw first -> nearest foreground vessels draw last!
    transparentVessels.sort((a, b) => b.distSq - a.distSq);

    for (let i = 0; i < transparentVessels.length; i++) {
        const baseOrder = 10 + i * 5;
        const list = transparentVessels[i].meshes;
        for (let j = 0; j < list.length; j++) {
            list[j].mesh.renderOrder = baseOrder + list[j].layer;
        }
    }
}

// ---------------------------------------------------------------------------
// Grounded Contact Shadow & Glass Caustic Decals (Eliminates Floating Look!)
// ---------------------------------------------------------------------------

function addGroundedDecal(parent, kind, width, depth, opacity = 0.65, yOffset = 0.0007, tintHex = null, additive = false) {
    const tex =
        kind === 'caustic'
            ? decalTextures.caustic
            : kind === 'rect'
            ? decalTextures.shadowRect
            : decalTextures.shadowRound;
    if (!tex) return null;

    const geo = new THREE.PlaneGeometry(width, depth);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: tintHex !== null ? new THREE.Color(tintHex) : new THREE.Color(0xffffff),
        transparent: true,
        opacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = yOffset;
    // Render grounded bench decals BEFORE all transparent liquids & glassware (prevents caustic bleed-through!)
    mesh.renderOrder = additive ? -1 : -2;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `__GroundedDecal_${kind}`;
    parent.add(mesh);
    return mesh;
}

// ---------------------------------------------------------------------------
// Highlight Ring Beacon & Ergonomic Pick Collider Helpers
// ---------------------------------------------------------------------------

function createHighlightBeacon(radius = 0.048) {
    const key = radius.toFixed(4);
    let geo = ringGeoCache.get(key);
    if (!geo) {
        if (decalTextures.highlightRing) {
            const dia = (radius + 0.014) * 2.15;
            geo = new THREE.PlaneGeometry(dia, dia);
            geo.rotateX(-Math.PI / 2);
        } else {
            geo = new THREE.RingGeometry(radius, radius + 0.0075, 48);
            geo.rotateX(-Math.PI / 2);
        }
        ringGeoCache.set(key, geo);
    }
    const mat = new THREE.MeshBasicMaterial({
        map: decalTextures.highlightRing || null,
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: decalTextures.highlightRing ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.0022;
    mesh.renderOrder = 2;
    mesh.visible = false;
    return mesh;
}

function addPickCollider(parent, interactId, shape, dims, offsetY = 0, extra = {}) {
    let geo;
    if (shape === 'cylinder') {
        geo = new THREE.CylinderGeometry(dims[0], dims[0], dims[1], 14);
    } else {
        geo = new THREE.BoxGeometry(dims[0], dims[1], dims[2]);
    }
    const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
    });
    const hit = new THREE.Mesh(geo, mat);
    hit.position.y = offsetY;
    hit.userData = { interactId, ...extra };
    hit.name = `__Hit_${interactId}`;
    parent.add(hit);
    pickTargets.push(hit);
    return hit;
}

// ---------------------------------------------------------------------------
// Live Spectronic 20D+ Digital 7-Segment LCD Canvas Texture
// ---------------------------------------------------------------------------

const SEG7_MAP = {
    '0': [1, 1, 1, 1, 1, 1, 0],
    '1': [0, 1, 1, 0, 0, 0, 0],
    '2': [1, 1, 0, 1, 1, 0, 1],
    '3': [1, 1, 1, 1, 0, 0, 1],
    '4': [0, 1, 1, 0, 0, 1, 1],
    '5': [1, 0, 1, 1, 0, 1, 1],
    '6': [1, 0, 1, 1, 1, 1, 1],
    '7': [1, 1, 1, 0, 0, 0, 0],
    '8': [1, 1, 1, 1, 1, 1, 1],
    '9': [1, 1, 1, 1, 0, 1, 1],
    '-': [0, 0, 0, 0, 0, 0, 1],
    ' ': [0, 0, 0, 0, 0, 0, 0],
};

function drawSevenSegChar(ctx, ch, x, y, w, h, t, litColor, ghostColor) {
    const mask = SEG7_MAP[ch] || SEG7_MAP[' '];
    const halfH = h * 0.5;
    const skew = 0.085; // Authentic subtle 7-segment italic slant!

    const drawH = (sx, sy, sw, on) => {
        ctx.fillStyle = on ? litColor : ghostColor;
        const p = t * 0.5;
        ctx.beginPath();
        ctx.moveTo(sx + p, sy);
        ctx.lineTo(sx + sw - p, sy);
        ctx.lineTo(sx + sw, sy + p);
        ctx.lineTo(sx + sw - p, sy + t);
        ctx.lineTo(sx + p, sy + t);
        ctx.lineTo(sx, sy + p);
        ctx.closePath();
        ctx.fill();
    };
    const drawV = (sx, sy, sh, on) => {
        ctx.fillStyle = on ? litColor : ghostColor;
        const p = t * 0.5;
        ctx.beginPath();
        ctx.moveTo(sx + p, sy);
        ctx.lineTo(sx + t, sy + p);
        ctx.lineTo(sx + t, sy + sh - p);
        ctx.lineTo(sx + p, sy + sh);
        ctx.lineTo(sx, sy + sh - p);
        ctx.lineTo(sx, sy + p);
        ctx.closePath();
        ctx.fill();
    };

    ctx.save();
    ctx.transform(1, 0, -skew, 1, x + h * skew, y);
    const pad = t * 0.55;
    drawH(pad, 0, w - 2 * pad, mask[0]);                    // A (top)
    drawV(w - t, pad, halfH - pad * 1.1, mask[1]);          // B (top-right)
    drawV(w - t, halfH + pad * 0.1, halfH - pad * 1.1, mask[2]); // C (bot-right)
    drawH(pad, h - t, w - 2 * pad, mask[3]);                // D (bottom)
    drawV(0, halfH + pad * 0.1, halfH - pad * 1.1, mask[4]);// E (bot-left)
    drawV(0, pad, halfH - pad * 1.1, mask[5]);              // F (top-left)
    drawH(pad, halfH - t * 0.5, w - 2 * pad, mask[6]);      // G (middle)
    ctx.restore();
}

function initSpecDisplayCanvas() {
    specLcdCanvas = document.createElement('canvas');
    specLcdCanvas.width = 512;
    specLcdCanvas.height = 160;
    specLcdCtx = specLcdCanvas.getContext('2d');
    specLcdTexture = new THREE.CanvasTexture(specLcdCanvas);
    specLcdTexture.flipY = false; // glTF 2.0 UV convention has V=0 at top
    specLcdTexture.colorSpace = THREE.SRGBColorSpace;
    specLcdTexture.anisotropy = 8;
}

function updateSpecDisplayTexture(specState, force = false) {
    if (!specLcdCtx || !specLcdTexture) return;
    const key = `${specState.reading}|${specState.wavelength}|${specState.isZeroed}|${specState.absorbanceMode}|${specState.cuvetteInsideId || ''}|${animState.beamFlash > 0.05 ? 1 : 0}`;
    if (!force && key === lastSpecDisplayKey) return;
    lastSpecDisplayKey = key;

    const ctx = specLcdCtx;
    const W = specLcdCanvas.width;
    const H = specLcdCanvas.height;

    // Deep recessed emerald-dark glass backlit scientific instrument display
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#05120d');
    grad.addColorStop(0.5, '#091f16');
    grad.addColorStop(1, '#04100b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle recessed bezel inner shadow on top & left edges
    const topShad = ctx.createLinearGradient(0, 0, 0, 18);
    topShad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    topShad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = topShad;
    ctx.fillRect(0, 0, W, 18);

    const leftShad = ctx.createLinearGradient(0, 0, 18, 0);
    leftShad.addColorStop(0, 'rgba(0, 0, 0, 0.60)');
    leftShad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = leftShad;
    ctx.fillRect(0, 0, 18, H);

    // Ultra-subtle LCD matrix texture
    ctx.fillStyle = 'rgba(130, 255, 160, 0.025)';
    for (let y = 0; y < H; y += 4) {
        ctx.fillRect(0, y, W, 1);
    }

    // Inner instrument frame hairline
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(7, 7, W - 14, H - 14);

    // Top status bar: Wavelength & Mode
    ctx.font = 'bold 19px "Consolas", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6ee7b7';
    ctx.fillText(`λ ${specState.wavelength} nm`, 18, 30);

    ctx.textAlign = 'right';
    ctx.fillStyle = specState.absorbanceMode ? '#d8b4fe' : '#7dd3fc';
    ctx.fillText(specState.absorbanceMode ? 'MODE: ABS' : 'MODE: %T', W - 18, 30);

    // Parse reading into numeric 7-segment part + unit suffix ('%T' or 'Abs')
    const raw = (specState.reading || '-- %T').trim();
    const match = raw.match(/^([0-9.\-]+)\s*(.*)$/);
    const numStr = match ? match[1] : '--';
    const unitStr = match ? match[2] : (specState.absorbanceMode ? 'Abs' : '%T');

    // Render authentic 5-slot 7-segment scientific LED/LCD digits with faint ghost '8' segments!
    const slots = [];
    const tokens = [];
    for (let i = 0; i < numStr.length; i++) {
        const c = numStr[i];
        if (c === '.' && tokens.length > 0) {
            tokens[tokens.length - 1].dot = true;
        } else {
            tokens.push({ ch: c, dot: false });
        }
    }
    const maxSlots = 5;
    while (slots.length + tokens.length < maxSlots) {
        slots.push({ ch: ' ', dot: false });
    }
    tokens.slice(-maxSlots).forEach((tk) => slots.push(tk));

    const unitX = W - 116;
    const digitW = 38;
    const digitH = 66;
    const digitGap = 15;
    const startX = unitX - maxSlots * (digitW + digitGap) - 4;
    const startY = 44;

    ctx.save();
    ctx.shadowColor = '#84ff2e';
    ctx.shadowBlur = animState.beamFlash > 0.05 ? 20 : 10;
    const litCol = '#c8ff32';
    const ghostCol = 'rgba(60, 148, 92, 0.032)';

    slots.forEach((slot, idx) => {
        const dx = startX + idx * (digitW + digitGap);
        drawSevenSegChar(ctx, slot.ch, dx, startY, digitW, digitH, 6.2, litCol, ghostCol);
        // Decimal point dot
        ctx.fillStyle = slot.dot ? litCol : ghostCol;
        ctx.beginPath();
        ctx.arc(dx + digitW + 5, startY + digitH - 4, 3.6, 0, Math.PI * 2);
        ctx.fill();
    });

    // Crisp illuminated unit annunciator ('%T' or 'Abs')
    ctx.font = 'bold 34px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a3e635';
    ctx.fillText(unitStr, unitX + 8, startY + digitH - 6);
    ctx.restore();

    // Bottom annunciators: ZEROED + CUVETTE SEATED
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = specState.isZeroed ? '#4ade80' : '#fbbf24';
    ctx.fillText(specState.isZeroed ? '● ZEROED' : '○ ZERO NEEDED', 18, 142);

    ctx.textAlign = 'right';
    ctx.fillStyle = specState.cuvetteInsideId ? '#38bdf8' : '#64748b';
    ctx.fillText(specState.cuvetteInsideId ? '■ CUVETTE SEATED' : '□ CHAMBER EMPTY', W - 18, 142);

    // Subtle anti-glare cover glass diagonal reflection across LCD
    const glassSheen = ctx.createLinearGradient(0, 0, W * 0.55, H);
    glassSheen.addColorStop(0.0, 'rgba(225, 245, 255, 0.08)');
    glassSheen.addColorStop(0.32, 'rgba(225, 245, 255, 0.02)');
    glassSheen.addColorStop(0.35, 'rgba(225, 245, 255, 0.0)');
    glassSheen.addColorStop(1.0, 'rgba(225, 245, 255, 0.0)');
    ctx.fillStyle = glassSheen;
    ctx.fillRect(0, 0, W, H);

    specLcdTexture.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Floating 3D-Projected Labels Overlay
// ---------------------------------------------------------------------------

let hoveredLabelId = null;

export function setHoveredLabelId(id) {
    hoveredLabelId = id || null;
}

function registerLabel(id, anchorPos, getText, accentColor = null) {
    if (!labelsOverlayEl) return;
    const el = document.createElement('div');
    el.className = 'label-3d';
    if (accentColor) {
        el.style.setProperty('--label-accent', accentColor);
        el.classList.add('label-3d--accented');
    }
    el.innerHTML = '<span class="label-3d__dot" aria-hidden="true"></span><span class="label-3d__txt"></span>';
    el.dataset.id = id;
    labelsOverlayEl.appendChild(el);
    labelAnchors.set(id, {
        el,
        txtEl: el.querySelector('.label-3d__txt'),
        offset: anchorPos.clone(),
        getText,
    });
}

export function setLabelsVisible(visible) {
    labelsVisible = Boolean(visible);
    if (labelsOverlayEl) {
        labelsOverlayEl.classList.add('labels-overlay');
        labelsOverlayEl.classList.toggle('labels-overlay--hidden', !labelsVisible);
    }
}

export function getLabelsVisible() {
    return labelsVisible;
}

function updateProjectedLabels() {
    if (!labelsVisible || !camera || !renderer) return;
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    if (width === 0 || height === 0) return;

    const state = getState();
    const tmp = new THREE.Vector3();
    const camDist = controls ? camera.position.distanceTo(controls.target) : 1.0;

    for (const [id, info] of labelAnchors.entries()) {
        const entry = objects3D.get(id);
        if (!entry) continue;

        const obj = findObjectById(id);
        const isHighlighted = state.highlights.includes(id);
        const isSelected = state.selectedObjectId === id || animState.draggedId === id;
        const isDropHover = animState.dropHoverId === id;
        const isHovered = hoveredLabelId === id;
        const isActive = isHighlighted || isSelected || isDropHover || isHovered;

        // Anti-clutter: Rack already displays engraved physical labels; in wide overview, show tube callouts ONLY when filled or active!
        if (entry.type === 'testTube' && camDist > 0.72 && !isActive && (!obj || obj.currentVolume <= 0.01)) {
            info.el.style.opacity = '0';
            continue;
        }

        entry.root.updateWorldMatrix(true, false);
        tmp.copy(info.offset).applyMatrix4(entry.root.matrixWorld);
        tmp.project(camera);

        if (tmp.z > 1 || tmp.z < -1) {
            info.el.style.opacity = '0';
            continue;
        }

        const sx = (tmp.x * 0.5 + 0.5) * width;
        const sy = (-tmp.y * 0.5 + 0.5) * height;
        // Cleanly hide labels that project off-screen or directly underneath floating HUD docks / immersive pill / side drawer
        const isImmersive = document.body.classList.contains('immersive-mode');
        const immMin = document.body.classList.contains('imm-proc-min');
        const immDrawerOpen = isImmersive && document.getElementById('imm-steps-drawer')?.classList.contains('imm-drawer--open');
        const outOfBounds = sx < 26 || sx > width - 26 || sy < 24 || sy > height - 48;
        const underTopLeftHud = sy < 66 && sx < Math.min(370, width * 0.36);
        const underTopRightHud = sy < 66 && sx > width - Math.min(540, width * 0.48);
        const underImmProc = isImmersive && !immMin && sy < 118 && sx > width * 0.14 && sx < width * 0.86;
        const underImmDrawer = immDrawerOpen && sx > width - 350 && sy > 52 && sy < height - 68;
        if (outOfBounds || underTopLeftHud || underTopRightHud || underImmProc || underImmDrawer) {
            info.el.style.opacity = '0';
            continue;
        }
        info.el.style.transform = `translate(-50%, calc(-100% - 10px)) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        info.el.style.opacity = isActive ? '1' : '0.68';

        const text = info.getText(obj, state);
        if (info.txtEl && info.txtEl.textContent !== text) {
            info.txtEl.textContent = text;
        }

        info.el.classList.toggle('label-3d--highlight', isHighlighted);
        info.el.classList.toggle('label-3d--selected', isSelected);
        info.el.classList.toggle('label-3d--drop', isDropHover);
        info.el.classList.toggle('label-3d--hovered', isHovered);
        info.el.classList.toggle('label-3d--ambient', !isActive);
    }
}

// ---------------------------------------------------------------------------
// Scene Initialization & Parallel GLB Asset Loading
// ---------------------------------------------------------------------------

export async function initScene3D(viewportEl, labelsEl, onProgress = null) {
    containerEl = viewportEl;
    labelsOverlayEl = labelsEl;
    clock = new THREE.Clock();

    const initW = containerEl.clientWidth || 960;
    const initH = containerEl.clientHeight || 560;

    // Renderer configured for linear-HDR MSAA PBR + Blender 5.2 AgX tone mapping + 4K soft shadows
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true, // Enables crisp visual inspection screenshots
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initW, initH);
    renderer.toneMapping = THREE.AgXToneMapping ?? THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = false;
    containerEl.appendChild(renderer.domElement);

    // Scene & subtle laboratory atmosphere
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x88909a);

    // Camera (ergonomic 35mm lab scientist perspective; preserves full bench horizontal span in taller Immersive / laptop / mobile viewports!)
    const BASE_VFOV = 38;
    const MIN_BENCH_ASPECT = 2.24; // Keeps all 3 dedicated pipettes (far left) through Spec 20D+ & Kimwipes (far right) completely in frame
    const calcResponsiveFov = (asp) => {
        if (asp >= MIN_BENCH_ASPECT) return BASE_VFOV;
        const baseHalfTan = Math.tan(THREE.MathUtils.degToRad(BASE_VFOV * 0.5));
        const neededHalfTan = baseHalfTan * (MIN_BENCH_ASPECT / Math.max(asp, 0.95));
        return Math.min(54, Math.max(BASE_VFOV, THREE.MathUtils.radToDeg(2 * Math.atan(neededHalfTan))));
    };
    const aspect = initW / initH;
    camera = new THREE.PerspectiveCamera(calcResponsiveFov(aspect), aspect, 0.04, 15.0);
    const ov = config.CAMERA_PRESETS.overview;
    camera.position.set(...ov.pos);

    // OrbitControls (damped, bounded so camera never clips below bench or behind wall)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...ov.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.28;
    controls.maxDistance = 1.85;
    controls.minPolarAngle = 0.14;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.panSpeed = 0.65;
    controls.update();

    // Bespoke Cycles-Rendered 3K University Analytical Chemistry Lab HDRI
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const ASSET_VER = '?v=6';
    try {
        const rgbeLoader = new RGBELoader();
        rgbeLoader.setDataType(THREE.FloatType);
        const hdrTex = await rgbeLoader.loadAsync(`./assets/env/lab_studio.hdr${ASSET_VER}`);
        if (hdrTex.image && hdrTex.image.data) {
            const d = hdrTex.image.data;
            for (let i = 0; i < d.length; i++) {
                const v = d[i];
                d[i] = Number.isFinite(v) ? Math.min(12.0, Math.max(0.0, v)) : 0.0;
            }
            hdrTex.needsUpdate = true;
        }
        const envRT = pmrem.fromEquirectangular(hdrTex);
        scene.environment = envRT.texture;
        if (scene.environmentRotation) {
            scene.environmentRotation.y = 0.0;
        }
        scene.environmentIntensity = 0.98;
        hdrTex.dispose();
    } catch (err) {
        console.warn('Fallback to RoomEnvironment (HDRI load issue):', err);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    }
    pmrem.dispose();

    // Photographic Chemistry Lab Lighting: Rich Chiaroscuro Sculpting Key + Restrained Ambient Fill (Keeps Solids Dense & Glass Sparkling!)
    const hemi = new THREE.HemisphereLight(0xf2f7ff, 0x0b1018, 0.11);
    scene.add(hemi);

    const shadowRes = renderer.capabilities.maxTextureSize >= 4096 ? 4096 : 2048;
    const keyLight = new THREE.DirectionalLight(0xfcfdff, 1.42);
    keyLight.position.set(-0.46, 1.54, 0.88);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(shadowRes, shadowRes);
    keyLight.shadow.camera.near = 0.2;
    keyLight.shadow.camera.far = 4.6;
    keyLight.shadow.camera.left = -2.25;
    keyLight.shadow.camera.right = 2.25;
    keyLight.shadow.camera.top = 1.35;
    keyLight.shadow.camera.bottom = -1.10;
    keyLight.shadow.bias = -0.00014;
    keyLight.shadow.normalBias = 0.0026;
    keyLight.shadow.radius = 2.8;
    scene.add(keyLight);

    // Cool north-facing multi-pane lab window rim fill from left (crisp glass & brushed metal separation)
    const rimLight = new THREE.DirectionalLight(0xd8ecff, 0.44);
    rimLight.position.set(-1.50, 0.78, -0.30);
    scene.add(rimLight);

    // Warm 4000K under-shelf laboratory task light bounce from upper-back
    const taskLight = new THREE.DirectionalLight(0xffeed4, 0.30);
    taskLight.position.set(0.15, 0.82, -0.85);
    scene.add(taskLight);

    // Subtle warm bounce from right side of lab
    const warmFill = new THREE.DirectionalLight(0xfff1da, 0.16);
    warmFill.position.set(1.35, 0.68, 0.65);
    scene.add(warmFill);

    // Whisper-subtle low front bounce so dark instrument undersides retain detail without lifting blacks
    const frontBounce = new THREE.DirectionalLight(0xe4ecf6, 0.04);
    frontBounce.position.set(0.0, 0.26, 1.45);
    scene.add(frontBounce);

    // Reusable fluid delivery / pour stream cylinder (Linear-HDR Beer-Lambert shader!)
    pourStreamMat = makeDynamicLiquidMat(getLiquidOpticalStyle(config.STOCK_CONCENTRATION, false, 0.008));
    const streamGeo = new THREE.CylinderGeometry(0.0013, 0.0009, 1.0, 14);
    streamGeo.translate(0, -0.5, 0); // origin at top spout/tip, extends down -Y
    pourStreamMesh = new THREE.Mesh(streamGeo, pourStreamMat);
    pourStreamMesh.visible = false;
    pourStreamMesh.renderOrder = 120;
    scene.add(pourStreamMesh);

    initSpecDisplayCanvas();

    // Load Cycles-Baked Bench Contact AO, Decals & all 14 GLBs in parallel!
    const texLoader = new THREE.TextureLoader();
    const loadTexSafe = async (url, isLinear = false) => {
        try {
            const t = await texLoader.loadAsync(url);
            t.colorSpace = isLinear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
            t.minFilter = THREE.LinearFilter;
            t.magFilter = THREE.LinearFilter;
            t.generateMipmaps = false;
            return t;
        } catch (err) {
            console.warn('Optional texture missing:', url, err);
            return null;
        }
    };

    const gltfLoader = new GLTFLoader();
    const assetPaths = {
        bench: './assets/models/lab_bench.glb',
        bottle_stock: './assets/models/bottle_stock.glb',
        bottle_water: './assets/models/bottle_water.glb',
        bottle_unknown: './assets/models/bottle_unknown.glb',
        pipette_stand: './assets/models/pipette_stand.glb',
        pipette_stock: './assets/models/pipette_stock.glb',
        pipette_water: './assets/models/pipette_water.glb',
        pipette_unknown: './assets/models/pipette_unknown.glb',
        test_tube_rack: './assets/models/test_tube_rack.glb',
        test_tube: './assets/models/test_tube.glb',
        cuvette_holder: './assets/models/cuvette_holder.glb',
        cuvette: './assets/models/cuvette.glb',
        waste_beaker: './assets/models/waste_beaker.glb',
        spec20: './assets/models/spec20.glb',
    };

    const keys = Object.keys(assetPaths);
    let loadedCount = 0;
    const loadedMap = {};

    const [shadowRound, shadowRect, caustic, highlightRing, benchAO] = await Promise.all([
        loadTexSafe(`./assets/textures/contact_shadow_round.png${ASSET_VER}`, false),
        loadTexSafe(`./assets/textures/contact_shadow_rect.png${ASSET_VER}`, false),
        loadTexSafe(`./assets/textures/glass_caustic.png${ASSET_VER}`, false),
        loadTexSafe(`./assets/textures/highlight_ring.png${ASSET_VER}`, false),
        loadTexSafe(`./assets/textures/bench_ao_v4.jpg${ASSET_VER}`, true),
        ...keys.map(async (k) => {
            const gltf = await gltfLoader.loadAsync(`${assetPaths[k]}${ASSET_VER}`);
            loadedMap[k] = gltf.scene;
            loadedCount++;
            if (onProgress) onProgress(loadedCount / keys.length);
        }),
    ]);
    decalTextures.shadowRound = shadowRound;
    decalTextures.shadowRect = shadowRect;
    decalTextures.caustic = caustic;
    decalTextures.highlightRing = highlightRing;

    if (benchAO) {
        opticalUniforms.uBenchAO.value = benchAO;
        opticalUniforms.uHasBenchBake.value = 1.0;
    }

    // Mount all apparatus at exact LAYOUT_3D world coordinates
    mountBench(loadedMap.bench);
    mountStaticStand('pipetteStand', loadedMap.pipette_stand, config.LAYOUT_3D.pipetteStand, [0.225, 0.115, 0.68]);
    mountStaticStand('testTubeRack', loadedMap.test_tube_rack, config.LAYOUT_3D.testTubeRack, [0.335, 0.115, 0.72]);
    mountStaticStand('cuvetteHolder', loadedMap.cuvette_holder, config.LAYOUT_3D.cuvetteHolder, [0.095, 0.095, 0.65]);

    mountBottle('stockBottle', loadedMap.bottle_stock, config.LAYOUT_3D.stockBottle, config.STOCK_CONCENTRATION, 0.052, 'Stock Blue #1');
    mountBottle('waterBottle', loadedMap.bottle_water, config.LAYOUT_3D.waterBottle, 0, 0.052, 'Distilled H₂O');
    mountBottle('unknownBottle', loadedMap.bottle_unknown, config.LAYOUT_3D.unknownBottle, -1, 0.046, 'Unknown Drink');

    mountPipette('pipette_stock', loadedMap.pipette_stock, config.LAYOUT_3D.pipette_stock, '#3b82f6');
    mountPipette('pipette_water', loadedMap.pipette_water, config.LAYOUT_3D.pipette_water, '#22d3ee');
    mountPipette('pipette_unknown', loadedMap.pipette_unknown, config.LAYOUT_3D.pipette_unknown, '#a855f7');

    // Instantiate 6 independent test tubes from the Blender test_tube.glb template!
    const tubeIds = ['tube_10_0', 'tube_8_2', 'tube_6_4', 'tube_4_6', 'tube_2_8', 'tube_0_10'];
    tubeIds.forEach((tid, idx) => {
        const clone = idx === 0 ? loadedMap.test_tube : loadedMap.test_tube.clone(true);
        mountTestTube(tid, clone, config.LAYOUT_3D[tid]);
    });

    mountCuvette('cuvette', loadedMap.cuvette, config.LAYOUT_3D.cuvette);
    mountWasteBeaker('wasteBeaker', loadedMap.waste_beaker, config.LAYOUT_3D.wasteBeaker);
    mountSpec20('spec20', loadedMap.spec20, config.LAYOUT_3D.spec20);

    // Apply initial label overlay visibility (clean photographic OFF by default)
    setLabelsVisible(labelsVisible);

    // Sync initial visual state immediately
    syncSceneFromState(true);

    // Resize listener + ResizeObserver (adapts FOV & renderer on the very first frame of Immersive / Theater / Fullscreen changes!)
    const onResize = () => {
        if (!containerEl || !renderer || !camera) return;
        const w = containerEl.clientWidth || 960;
        const h = containerEl.clientHeight || 560;
        const asp = w / h;
        camera.aspect = asp;
        camera.fov = calcResponsiveFov(asp);
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    if (typeof ResizeObserver !== 'undefined' && containerEl) {
        const ro = new ResizeObserver(() => onResize());
        ro.observe(containerEl);
    }

    // Start crisp 60fps native WebGL2 MSAA PBR render loop (zero multi-pass flicker or refraction blackouts!)
    const animate = () => {
        rafId = requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.05);
        updateAnimations(dt);
        controls.update();
        updateTransparentSortOrder();

        renderer.render(scene, camera);
        updateProjectedLabels();
    };
    animate();

    return {
        renderer,
        scene,
        camera,
        controls,
        domElement: renderer.domElement,
    };
}

// ---------------------------------------------------------------------------
// Apparatus Mount Helpers
// ---------------------------------------------------------------------------

function mountBench(gltfScene) {
    enhanceLoadedAssetMaterials(gltfScene);
    gltfScene.traverse((o) => {
        if (o.isMesh) {
            const isPropCaster =
                o.name.startsWith('LabEnvV2_Amber') ||
                o.name.startsWith('LabEnvV2_Shelf') ||
                o.name.startsWith('LabEnvV2_LabManual') ||
                o.name.startsWith('LabEnvV3_Kimwipes') ||
                o.name.startsWith('LabEnvV3_WashBottle') ||
                o.name.startsWith('LabEnvV3_SpecPowerCord') ||
                o.name.startsWith('LabEnvV3_WallPlug') ||
                o.name.startsWith('LabEnvV4_Pilaster') ||
                o.name.startsWith('LabEnvV4_Bracket') ||
                o.name.startsWith('LabEnvV4_ShelfGuardRail') ||
                o.name.startsWith('LabEnvV4_RailPost') ||
                o.name.startsWith('LabEnvV4_FoldedKimwipe') ||
                o.name.startsWith('LabEnvV4_Sharpie') ||
                o.name.startsWith('WallReagentShelf');
            o.castShadow = isPropCaster;
            o.receiveShadow = true;
        }
    });
    // Fallback contact decal ONLY if Cycles-baked bench_ao_v4.jpg failed to load
    if (opticalUniforms.uHasBenchBake.value < 0.5) {
        const kimShadow = addGroundedDecal(gltfScene, 'rect', 0.165, 0.165, 0.72, 0.0007);
        if (kimShadow) {
            kimShadow.position.set(0.76, 0.0007, -0.14);
            kimShadow.rotation.y = -0.28;
        }
    }
    scene.add(gltfScene);
}

function mountStaticStand(id, gltfScene, posCfg, shadowDims = null) {
    enhanceLoadedAssetMaterials(gltfScene, {
        trackSorting: true,
        sortRoot: gltfScene,
        sortCenterY: id === 'pipetteStand' ? 0.135 : 0.06,
    });
    gltfScene.position.set(posCfg.x, posCfg.y, posCfg.z);
    gltfScene.rotation.y = posCfg.rotY || 0;
    if (shadowDims && opticalUniforms.uHasBenchBake.value < 0.5) {
        addGroundedDecal(gltfScene, 'rect', shadowDims[0], shadowDims[1], shadowDims[2], 0.0007);
    }
    scene.add(gltfScene);
}

function mountBottle(id, gltfScene, posCfg, initialConc, beaconRadius, displayName) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    const isSmall = id === 'unknownBottle';
    const vesselThickness = isSmall ? 0.048 : 0.058;
    const { liquidMat: liqMat, meniscusMat } = enhanceLoadedAssetMaterials(gltfScene, {
        hasDynamicLiquid: true,
        vesselThickness,
        liquidStyle: getLiquidOpticalStyle(initialConc, false, vesselThickness),
        trackSorting: true,
        sortRoot: group,
        sortCenterY: 0.08,
    });

    const metaNode = gltfScene.children[0] || gltfScene;
    const liquidBaseY = metaNode.userData?.liquidBaseY ?? 0.0076;
    const liquidMaxHeight = metaNode.userData?.liquidMaxHeight ?? (isSmall ? 0.082 : 0.104);
    const neckTopY = metaNode.userData?.neckTopY ?? (isSmall ? 0.156 : 0.184);

    // Fallback contact shadow when Cycles-baked bench_ao_v4 is unavailable + subtle realistic liquid transmission caustic
    const shadowDia = isSmall ? 0.114 : 0.130;
    if (opticalUniforms.uHasBenchBake.value < 0.5) {
        addGroundedDecal(group, 'round', shadowDia, shadowDia, 0.66, 0.0007);
    }
    const causticTint = id === 'stockBottle' ? 0x0ea5e9 : id === 'unknownBottle' ? 0xa855f7 : 0xe0f2fe;
    const causticAlpha = id === 'waterBottle' ? 0.055 : 0.095;
    addGroundedDecal(group, 'caustic', shadowDia * 1.12, shadowDia * 1.12, causticAlpha, 0.0009, causticTint, true);

    const liquidBody = findExactOrDotNode(gltfScene, 'LiquidBody');
    const liquidMeniscus = findExactOrDotNode(gltfScene, 'LiquidMeniscus');
    const bottleCap = findExactOrDotNode(gltfScene, 'BottleCap');
    const capRestPos = bottleCap ? bottleCap.position.clone() : new THREE.Vector3(0, neckTopY, 0);

    const beacon = createHighlightBeacon(beaconRadius);
    group.add(beacon);

    addPickCollider(group, id, 'cylinder', [isSmall ? 0.044 : 0.050, neckTopY + 0.025], (neckTopY + 0.025) * 0.5);

    objects3D.set(id, {
        id,
        type: 'bottle',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        liquidMat: liqMat,
        meniscusMat,
        vesselThickness,
        liquidBody,
        liquidMeniscus,
        liquidBaseY,
        liquidMaxHeight,
        neckTopY,
        bottleCap,
        capRestPos,
        beacon,
        mouthOffset: new THREE.Vector3(0, neckTopY + 0.012, 0),
    });
    animState.fillRatios.set(id, 1.0);
    animState.capOpen.set(id, 0.0);

    // Subtle crisp optical anchor directly above each reagent bottle cap (no tall visual stagger clutter!)
    const bottleLabelHeights = {
        stockBottle: neckTopY + 0.014,
        waterBottle: neckTopY + 0.036,
        unknownBottle: neckTopY + 0.014,
    };
    const bottleAccent = id === 'stockBottle' ? '#3b82f6' : id === 'waterBottle' ? '#22d3ee' : '#a855f7';
    registerLabel(id, new THREE.Vector3(0, bottleLabelHeights[id] ?? neckTopY + 0.020, 0), () => displayName, bottleAccent);
}

function mountPipette(id, gltfScene, posCfg, accentColor) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    const vesselThickness = 0.009;
    const { liquidMat: liqMat, meniscusMat } = enhanceLoadedAssetMaterials(gltfScene, {
        hasDynamicLiquid: true,
        vesselThickness,
        liquidStyle: getLiquidOpticalStyle(0, false, vesselThickness),
        trackSorting: true,
        sortRoot: group,
        sortCenterY: 0.12,
    });

    const metaNode = gltfScene.children[0] || gltfScene;
    const liquidBaseY = metaNode.userData?.liquidBaseY ?? 0.036;
    const liquidMaxHeight = metaNode.userData?.liquidMaxHeight ?? 0.146;

    const liquidTip = findExactOrDotNode(gltfScene, 'LiquidTip');
    const liquidStem = findExactOrDotNode(gltfScene, 'LiquidStem');
    const liquidMeniscus = findExactOrDotNode(gltfScene, 'LiquidMeniscus');
    const bulb = findExactOrDotNode(gltfScene, 'PipetteBulb');

    // Beacon sits at stand drip-cup height just beneath pipette tip
    const beacon = createHighlightBeacon(0.020);
    beacon.position.y = 0.002;
    group.add(beacon);

    // Generous ergonomic picking cylinder spanning entire pipette (tip to bulb)
    addPickCollider(group, id, 'cylinder', [0.021, 0.255], 0.128);

    objects3D.set(id, {
        id,
        type: 'pipette',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        liquidMat: liqMat,
        meniscusMat,
        vesselThickness,
        liquidTip,
        liquidStem,
        liquidMeniscus,
        bulb,
        liquidBaseY,
        liquidMaxHeight,
        beacon,
    });
    animState.fillRatios.set(id, 0.0);

    // Compact optical anchor cleanly above pipette bulbs
    const pipLabelY = id === 'pipette_water' ? 0.278 : 0.246;
    registerLabel(
        id,
        new THREE.Vector3(0, pipLabelY, 0),
        (obj) => {
            if (!obj) return '';
            return obj.currentVolume > 0
                ? `${obj.shortLabel} · ${obj.currentVolume.toFixed(0)}mL`
                : obj.shortLabel;
        },
        accentColor
    );
}

function mountTestTube(id, gltfScene, posCfg) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    const vesselThickness = 0.022;
    const { liquidMat: liqMat, meniscusMat } = enhanceLoadedAssetMaterials(gltfScene, {
        hasDynamicLiquid: true,
        vesselThickness,
        liquidStyle: getLiquidOpticalStyle(0, false, vesselThickness),
        trackSorting: true,
        sortRoot: group,
        sortCenterY: 0.08,
    });

    const metaNode = gltfScene.children[0] || gltfScene;
    const domeTopY = metaNode.userData?.domeTopY ?? 0.0125;
    const columnMaxHeight = metaNode.userData?.columnMaxHeight ?? 0.1045;

    const liquidBottom = findExactOrDotNode(gltfScene, 'LiquidBottom');
    const liquidColumn = findExactOrDotNode(gltfScene, 'LiquidColumn');
    const liquidMeniscus = findExactOrDotNode(gltfScene, 'LiquidMeniscus');

    // Highlight halo right around the test tube rim at top of rack!
    const beacon = createHighlightBeacon(0.0175);
    beacon.position.y = 0.078;
    group.add(beacon);

    addPickCollider(group, id, 'cylinder', [0.0185, 0.158], 0.078);

    objects3D.set(id, {
        id,
        type: 'testTube',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        liquidMat: liqMat,
        meniscusMat,
        vesselThickness,
        liquidBottom,
        liquidColumn,
        liquidMeniscus,
        domeTopY,
        columnMaxHeight,
        beacon,
        mouthOffset: new THREE.Vector3(0, 0.152, 0),
    });
    animState.fillRatios.set(id, 0.0);

    // Clean uniform optical baseline above test tube rims (clears adjacent Unknown bottle label cleanly!)
    registerLabel(id, new THREE.Vector3(0, 0.178, 0), (obj) => {
        if (!obj) return '';
        const short = obj.label.replace(' (Blank)', '');
        return obj.currentVolume > 0 ? `${short} · ${obj.currentVolume.toFixed(0)}mL` : short;
    }, '#38bdf8');
}

function mountCuvette(id, gltfScene, posCfg) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    const vesselThickness = 0.014;
    const { liquidMat: liqMat, meniscusMat } = enhanceLoadedAssetMaterials(gltfScene, {
        hasDynamicLiquid: true,
        vesselThickness,
        liquidStyle: getLiquidOpticalStyle(0, false, vesselThickness),
        trackSorting: true,
        sortRoot: group,
        sortCenterY: 0.036,
    });

    const metaNode = gltfScene.children[0] || gltfScene;
    const liquidBaseY = metaNode.userData?.liquidBaseY ?? 0.0059;
    const liquidMaxHeight = metaNode.userData?.liquidMaxHeight ?? 0.0536;

    const liquidBody = findExactOrDotNode(gltfScene, 'LiquidBody');
    const liquidMeniscus = findExactOrDotNode(gltfScene, 'LiquidMeniscus');
    const residueFilm = findExactOrDotNode(gltfScene, 'ResidueFilm');
    if (residueFilm) {
        // Subtle residual wet droplet film at the base of an unrinsed cuvette (NOT a half-full liquid block!)
        residueFilm.scale.set(0.96, 0.16, 0.96);
    }

    const beacon = createHighlightBeacon(0.032);
    beacon.position.y = -0.003;
    group.add(beacon);

    // Ergonomic click/drag box around optical cuvette (also easily grabbable when seated inside Spec 20D+ chamber!)
    addPickCollider(group, id, 'box', [0.056, 0.098, 0.056], 0.044);

    objects3D.set(id, {
        id,
        type: 'cuvette',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        liquidMat: liqMat,
        meniscusMat,
        vesselThickness,
        liquidBody,
        liquidMeniscus,
        residueFilm,
        liquidBaseY,
        liquidMaxHeight,
        beacon,
        mouthOffset: new THREE.Vector3(0, 0.072, 0),
    });
    animState.fillRatios.set(id, 0.0);

    // Place label cleanly in front of cuvette holder so it NEVER covers the test tube rack nameplate!
    registerLabel(id, new THREE.Vector3(0, -0.004, 0.042), (obj) => {
        if (!obj) return 'Cuvette';
        if (obj.isInSpec) return 'Cuvette (In Spec)';
        if (obj.currentVolume > 0) return `Cuvette (${obj.currentVolume.toFixed(0)} mL)`;
        return obj.isClean ? 'Cuvette (Clean)' : 'Cuvette (Rinse!)';
    });
}

function mountWasteBeaker(id, gltfScene, posCfg) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    const vesselThickness = 0.044;
    const { liquidMat: liqMat, meniscusMat } = enhanceLoadedAssetMaterials(gltfScene, {
        hasDynamicLiquid: true,
        vesselThickness,
        liquidStyle: getLiquidOpticalStyle(null, true, vesselThickness),
        trackSorting: true,
        sortRoot: group,
        sortCenterY: 0.05,
    });

    const metaNode = gltfScene.children[0] || gltfScene;
    const liquidBaseY = metaNode.userData?.liquidBaseY ?? 0.005;
    const liquidMaxHeight = metaNode.userData?.liquidMaxHeight ?? 0.087;

    const liquidBody = findExactOrDotNode(gltfScene, 'LiquidBody');
    const liquidMeniscus = findExactOrDotNode(gltfScene, 'LiquidMeniscus');

    // Fallback contact shadow ONLY when Cycles-baked bench_ao_v4 is unavailable
    if (opticalUniforms.uHasBenchBake.value < 0.5) {
        addGroundedDecal(group, 'round', 0.128, 0.128, 0.62, 0.0007);
        addGroundedDecal(group, 'caustic', 0.138, 0.138, 0.10, 0.0009, 0x7dd3fc, true);
    }

    const beacon = createHighlightBeacon(0.052);
    group.add(beacon);

    addPickCollider(group, id, 'cylinder', [0.052, 0.125], 0.062);

    objects3D.set(id, {
        id,
        type: 'beaker',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        liquidMat: liqMat,
        meniscusMat,
        vesselThickness,
        liquidBody,
        liquidMeniscus,
        liquidBaseY,
        liquidMaxHeight,
        beacon,
        mouthOffset: new THREE.Vector3(0, 0.118, 0),
    });
    animState.fillRatios.set(id, 0.0);

    // Place label cleanly in front of waste beaker base so it NEVER overlaps Test Tube Rack or Spec 20D+!
    registerLabel(id, new THREE.Vector3(0.010, -0.002, 0.062), (obj) => {
        if (!obj) return 'Waste';
        return obj.currentVolume > 0 ? `Waste (${obj.currentVolume.toFixed(0)} mL)` : 'Waste Beaker';
    });
}

function mountSpec20(id, gltfScene, posCfg) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    enhanceLoadedAssetMaterials(gltfScene);

    // Ensure NIST calibration inspection sticker clears SpecUpperShell top bevel cleanly
    const calSticker = findExactOrDotNode(gltfScene, 'DetailV4_CalSticker');
    if (calSticker) {
        calSticker.position.y += 0.0006;
    }

    // Fallback chassis contact shadow ONLY when Cycles-baked bench_ao_v4 is unavailable
    if (opticalUniforms.uHasBenchBake.value < 0.5) {
        addGroundedDecal(group, 'rect', 0.41, 0.30, 0.82, 0.0007);
    }

    // Subtle real-time emerald LCD light bounce positioned below display bezel onto keycaps (ZERO specular dot on LCD glass!)
    const lcdGlow = new THREE.PointLight(0x4ade80, 0.005, 0.085, 2.5);
    lcdGlow.position.set(-0.048, 0.052, 0.132);
    group.add(lcdGlow);

    // Wire live HTML5 CanvasTexture onto the Spec 20 digital LCD screen mesh!
    const displayMesh = findExactOrDotNode(gltfScene, 'SpecDisplay');
    if (displayMesh && displayMesh.isMesh) {
        displayMesh.material = new THREE.MeshPhysicalMaterial({
            map: specLcdTexture,
            emissiveMap: specLcdTexture,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 1.16,
            roughness: 0.18,
            metalness: 0.02,
            clearcoat: 0.35,
            clearcoatRoughness: 0.14,
            envMapIntensity: 0.45,
        });
    }

    const lidPivot = findExactOrDotNode(gltfScene, 'SpecLid');
    const beamLed = findExactOrDotNode(gltfScene, 'OpticalBeamLED');

    // Wire individually clickable 3D physical buttons (`BtnZero`, `BtnMeasure`, `BtnMode`)
    const btnNodes = {
        zero: findExactOrDotNode(gltfScene, 'BtnZero'),
        measure: findExactOrDotNode(gltfScene, 'BtnMeasure'),
        mode: findExactOrDotNode(gltfScene, 'BtnMode'),
    };
    const btnRestZ = {};

    Object.entries(btnNodes).forEach(([btnKey, node]) => {
        if (!node) return;
        btnRestZ[btnKey] = node.position.z;
        // Tag all child meshes + add generous invisible click pad right over each button face
        node.traverse((ch) => {
            if (ch.isMesh) {
                ch.userData.interactId = `btn_${btnKey}`;
                ch.userData.specButton = btnKey;
                pickTargets.push(ch);
            }
        });
        const pad = new THREE.Mesh(
            new THREE.BoxGeometry(0.058, 0.032, 0.024),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
        );
        pad.position.set(0, 0, 0.008);
        pad.userData = { interactId: `btn_${btnKey}`, specButton: btnKey };
        node.add(pad);
        pickTargets.push(pad);
    });

    // Main Spec 20 drop target collider (sample compartment & instrument body)
    addPickCollider(group, id, 'box', [0.35, 0.16, 0.25], 0.08);

    const metaNode = gltfScene.children[0] || gltfScene;
    const slotLocal = new THREE.Vector3(
        metaNode.userData?.slotLocalX ?? 0.098,
        metaNode.userData?.slotLocalY ?? 0.100,
        metaNode.userData?.slotLocalZ ?? -0.022
    );

    // Highlight beacon directly around the Spec 20 optical sample compartment on top deck!
    const beacon = createHighlightBeacon(0.036);
    beacon.position.set(slotLocal.x, 0.155, slotLocal.z);
    group.add(beacon);

    objects3D.set(id, {
        id,
        type: 'spectrophotometer',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        lidPivot,
        beamLed,
        btnNodes,
        btnRestZ,
        slotLocal,
        beacon,
        mouthOffset: new THREE.Vector3(slotLocal.x, 0.185, slotLocal.z),
    });

    // Place Spec 20 label cleanly above the left display deck so Cuvette (In Spec) on the right never collides
    registerLabel(id, new THREE.Vector3(-0.075, 0.195, 0.0), (obj, st) => {
        return `Spec 20D+ • ${st.spec20State.reading}`;
    });
}

// ---------------------------------------------------------------------------
// State -> 3D Synchronization & Choreographed Action Effects
// ---------------------------------------------------------------------------

export function getWorldMouthPosition(id) {
    const entry = objects3D.get(id);
    if (!entry) return new THREE.Vector3();
    entry.root.updateWorldMatrix(true, false);
    const offset = entry.mouthOffset || new THREE.Vector3(0, 0.15, 0);
    return offset.clone().applyMatrix4(entry.root.matrixWorld);
}

export function getSpecCuvetteWorldTransform() {
    const spec = objects3D.get('spec20');
    if (!spec) return { pos: new THREE.Vector3(0.45, 0.10, -0.11), rotY: 0 };
    spec.root.updateWorldMatrix(true, false);
    const worldPos = spec.slotLocal.clone().applyMatrix4(spec.root.matrixWorld);
    return { pos: worldPos, rotY: spec.homeRotY };
}

export function syncSceneFromState(immediate = false) {
    const state = getState();
    if (!scene) return;

    // On immediate sync (Reset Lab / initial mount), cancel any in-flight choreography cleanly!
    if (immediate) {
        animState.activeChoreo = null;
        animState.draggedId = null;
        animState.dropHoverId = null;
        animState.capHoverTarget = null;
        animState.lidTarget = 0;
        if (pourStreamMesh) pourStreamMesh.visible = false;
        ['pipette_stock', 'pipette_water', 'pipette_unknown'].forEach((pid) => {
            const pEntry = objects3D.get(pid);
            const pObj = findObjectById(pid);
            if (!pEntry) return;
            if (!pObj || pObj.currentVolume <= 0.001) {
                animState.loadedHoldPos.delete(pid);
                pEntry.root.position.copy(pEntry.homePos);
            } else {
                const holdPos = animState.loadedHoldPos.get(pid) || pEntry.homePos.clone().add(new THREE.Vector3(0, 0.045, 0));
                pEntry.root.position.copy(holdPos);
            }
            pEntry.root.rotation.set(0, pEntry.homeRotY, 0);
            if (pEntry.bulb) pEntry.bulb.scale.set(1, 1, 1);
        });
    }

    // Update Spec 20 digital LCD texture
    updateSpecDisplayTexture(state.spec20State, immediate);

    // Sync liquids & cleanliness flags across all vessels
    state.labObjects.forEach((obj) => {
        const entry = objects3D.get(obj.id);
        if (!entry) return;

        const targetRatio = obj.maxVolume > 0 ? Math.max(0, Math.min(1, obj.currentVolume / obj.maxVolume)) : 0;
        if (immediate) {
            animState.fillRatios.set(obj.id, targetRatio);
        }

        // Update liquid optical properties (Volumetric Beer-Lambert + Clear-Water Cylindrical Refraction!)
        if (entry.liquidMat) {
            const conc = obj.type === 'pipette' ? obj.contentsConcentration : obj.concentration;
            const style = getLiquidOpticalStyle(conc, obj.type === 'beaker', entry.vesselThickness ?? 0.032);
            entry.liquidMat.color.copy(style.color);
            entry.liquidMat.emissive.copy(style.emissive);
            entry.liquidMat.emissiveIntensity = style.emissiveIntensity ?? 0.20;
            entry.liquidMat.opacity = style.opacity ?? 0.65;
            entry.liquidMat.roughness = style.roughness ?? 0.022;
            entry.liquidMat.envMapIntensity = style.envMapIntensity ?? 1.15;
            if (entry.liquidMat.userData?.uIsClearWater) {
                entry.liquidMat.userData.uIsClearWater.value = style.isClearWater ? 1.0 : 0.0;
            }

            if (entry.meniscusMat) {
                entry.meniscusMat.color.copy(style.color);
                entry.meniscusMat.emissive.copy(style.emissive);
                entry.meniscusMat.emissiveIntensity = (style.emissiveIntensity ?? 0.16) * 0.85;
                entry.meniscusMat.opacity = style.meniscusOpacity ?? 0.72;
                if (entry.meniscusMat.userData?.uIsClearWater) {
                    entry.meniscusMat.userData.uIsClearWater.value = style.isClearWater ? 1.0 : 0.0;
                }
            }
        }

        // Cuvette residue film (visible when empty AND dirty / awaiting rinse!)
        if (entry.residueFilm) {
            entry.residueFilm.visible = !obj.isClean && obj.currentVolume < 0.01;
        }
    });

    // Ensure cuvette docks in Spec 20 or its holder when not dragging or animating
    const cuvObj = findObjectById('cuvette');
    const cuvEntry = objects3D.get('cuvette');
    if (cuvObj && cuvEntry && animState.draggedId !== 'cuvette' && (!animState.activeChoreo || animState.activeChoreo.actorId !== 'cuvette')) {
        if (cuvObj.isInSpec) {
            const { pos, rotY } = getSpecCuvetteWorldTransform();
            if (immediate) {
                cuvEntry.root.position.copy(pos);
                cuvEntry.root.rotation.set(0, rotY, 0);
            }
        } else if (immediate) {
            cuvEntry.root.position.copy(cuvEntry.homePos);
            cuvEntry.root.rotation.set(0, cuvEntry.homeRotY, 0);
        }
    }
}

export function triggerActionEffect(type, payload = {}) {
    if (type === 'buttonPress') {
        if (payload.button && Object.prototype.hasOwnProperty.call(animState.btnPress, payload.button)) {
            animState.btnPress[payload.button] = 1.0;
        }
        return;
    }

    if (type === 'zeroSpec' || type === 'measure') {
        animState.beamFlash = 1.0;
        animState.lidTarget = 0.0;
        return;
    }

    if (type === 'fillPipette') {
        const pip = objects3D.get(payload.pipetteId);
        const src = objects3D.get(payload.sourceId);
        if (!pip || !src) return;
        const mouth = getWorldMouthPosition(payload.sourceId);
        const startPos = pip.root.position.clone();
        const hoverPos = mouth.clone().add(new THREE.Vector3(0, 0.050, 0));
        const dipPos = mouth.clone().add(new THREE.Vector3(0, -0.025, 0));
        // Poise cleanly in front of the source vessel at hand height (100% framed tip-to-bulb, clear of bottle cap & HUD)
        // so user moves straight to target tube/cuvette without returning to the pipette stand!
        const isBottle = src.type === 'bottle';
        const readyPos = new THREE.Vector3(
            src.root.position.x + (isBottle ? 0.055 : 0.0),
            0.085,
            src.root.position.z + (isBottle ? 0.155 : 0.140)
        );
        animState.loadedHoldPos.set(payload.pipetteId, readyPos.clone());

        animState.activeChoreo = {
            kind: 'fillPipette',
            actorId: payload.pipetteId,
            sourceId: payload.sourceId,
            elapsed: 0,
            duration: 0.64,
            startPos,
            hoverPos,
            dipPos,
            endPos: readyPos,
        };
        return;
    }

    if (type === 'dispensePipette') {
        const pip = objects3D.get(payload.pipetteId);
        const dest = objects3D.get(payload.destId);
        if (!pip || !dest) return;
        animState.loadedHoldPos.delete(payload.pipetteId);
        const mouth = getWorldMouthPosition(payload.destId);
        const startPos = pip.root.position.clone();
        const dispensePos = mouth.clone().add(new THREE.Vector3(0, 0.018, 0));
        const style = getLiquidOpticalStyle(payload.concentration, false, 0.010);

        animState.activeChoreo = {
            kind: 'dispensePipette',
            actorId: payload.pipetteId,
            destId: payload.destId,
            elapsed: 0,
            duration: 0.68,
            startPos,
            dispensePos,
            streamTargetY: dest.root.position.y + 0.035,
            streamStyle: style,
            endPos: pip.homePos.clone(),
        };
        return;
    }

    if (type === 'insertCuvette') {
        const cuv = objects3D.get('cuvette');
        if (!cuv) return;
        const { pos: slotPos, rotY: slotRotY } = getSpecCuvetteWorldTransform();
        const aboveSlot = slotPos.clone().add(new THREE.Vector3(0, 0.115, 0));
        animState.activeChoreo = {
            kind: 'insertCuvette',
            actorId: 'cuvette',
            elapsed: 0,
            duration: 0.65,
            startPos: cuv.root.position.clone(),
            aboveSlot,
            endPos: slotPos,
            endRotY: slotRotY,
        };
        return;
    }

    if (type === 'removeCuvette') {
        const cuv = objects3D.get('cuvette');
        if (!cuv) return;
        animState.lidTarget = 1.0;
        setTimeout(() => {
            if (animState.draggedId !== 'cuvette') animState.lidTarget = 0.0;
        }, 550);
        return;
    }

    if (type === 'emptyCuvette') {
        const cuv = objects3D.get('cuvette');
        const waste = objects3D.get('wasteBeaker');
        if (!cuv || !waste) return;
        // Offset cuvette base left of waste rim so tilted open mouth hangs directly over beaker center!
        const wasteRim = getWorldMouthPosition('wasteBeaker').add(new THREE.Vector3(-0.056, 0.044, 0));
        const style = getLiquidOpticalStyle(payload.concentration, false, 0.012);

        animState.activeChoreo = {
            kind: 'emptyCuvette',
            actorId: 'cuvette',
            elapsed: 0,
            duration: 0.85,
            startPos: cuv.root.position.clone(),
            pourPos: wasteRim,
            streamTargetY: waste.root.position.y + 0.018,
            streamStyle: style,
            endPos: cuv.homePos.clone(),
        };
    }
}

// ---------------------------------------------------------------------------
// Per-Frame 60fps Animation Engine
// ---------------------------------------------------------------------------

function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function applyLiquidGeometry(entry, ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    const hasLiq = r > 0.002;

    if (entry.type === 'bottle' || entry.type === 'cuvette' || entry.type === 'beaker') {
        if (entry.liquidBody) {
            entry.liquidBody.visible = hasLiq;
            entry.liquidBody.scale.y = Math.max(0.001, r);
        }
        if (entry.liquidMeniscus) {
            entry.liquidMeniscus.visible = hasLiq;
            entry.liquidMeniscus.position.y = entry.liquidBaseY + entry.liquidMaxHeight * r;
        }
    } else if (entry.type === 'pipette') {
        if (entry.liquidTip) entry.liquidTip.visible = hasLiq;
        if (entry.liquidStem) {
            entry.liquidStem.visible = hasLiq;
            entry.liquidStem.scale.y = Math.max(0.015, r);
        }
        if (entry.liquidMeniscus) {
            entry.liquidMeniscus.visible = hasLiq;
            entry.liquidMeniscus.position.y = entry.liquidBaseY + entry.liquidMaxHeight * r;
        }
    } else if (entry.type === 'testTube') {
        if (entry.liquidBottom) entry.liquidBottom.visible = hasLiq;
        const colRatio = hasLiq ? Math.max(0, Math.min(1, (r - 0.04) / 0.96)) : 0;
        if (entry.liquidColumn) {
            entry.liquidColumn.visible = colRatio > 0.002;
            entry.liquidColumn.scale.y = Math.max(0.001, colRatio);
        }
        if (entry.liquidMeniscus) {
            entry.liquidMeniscus.visible = hasLiq;
            entry.liquidMeniscus.position.y = entry.domeTopY + entry.columnMaxHeight * colRatio;
        }
    }
}

function updateAnimations(dt) {
    const now = performance.now() * 0.001;
    const state = getState();
    const damp = 1 - Math.exp(-10 * dt);

    // 1. Camera Preset Smooth Flight
    if (animState.cameraFlight) {
        const fl = animState.cameraFlight;
        fl.elapsed += dt;
        const u = smoothstep(0, fl.duration, fl.elapsed);
        camera.position.lerpVectors(fl.fromPos, fl.toPos, u);
        controls.target.lerpVectors(fl.fromTarget, fl.toTarget, u);
        if (fl.elapsed >= fl.duration) {
            animState.cameraFlight = null;
        }
    }

    // 2. Smooth Liquid Levels Across All Apparatus
    state.labObjects.forEach((obj) => {
        const entry = objects3D.get(obj.id);
        if (!entry) return;
        const targetRatio = obj.maxVolume > 0 ? Math.max(0, Math.min(1, obj.currentVolume / obj.maxVolume)) : 0;
        const cur = animState.fillRatios.get(obj.id) ?? targetRatio;
        const next = cur + (targetRatio - cur) * Math.min(1, dt * 8.5);
        animState.fillRatios.set(obj.id, Math.abs(targetRatio - next) < 0.0005 ? targetRatio : next);
        applyLiquidGeometry(entry, next);
    });

    // 3. Reagent Bottle Cap Lift-Off Animation (when hovered by pipette or actively aspirating!)
    ['stockBottle', 'waterBottle', 'unknownBottle'].forEach((bid) => {
        const entry = objects3D.get(bid);
        if (!entry || !entry.bottleCap) return;
        const wantOpen =
            animState.capHoverTarget === bid ||
            (animState.activeChoreo?.kind === 'fillPipette' && animState.activeChoreo.sourceId === bid);
        const cur = animState.capOpen.get(bid) ?? 0;
        const target = wantOpen ? 1 : 0;
        const next = cur + (target - cur) * damp;
        animState.capOpen.set(bid, next);

        entry.bottleCap.position.set(
            entry.capRestPos.x + next * 0.048,
            entry.capRestPos.y + Math.sin(next * Math.PI) * 0.028 + next * 0.015,
            entry.capRestPos.z - next * 0.012
        );
        entry.bottleCap.rotation.z = -next * 0.55;
        entry.bottleCap.rotation.y = next * 2.4;
    });

    // 4. Spec 20 Hinged Sample Compartment Lid & Buttons & 630nm Optical Beam Flash
    const spec = objects3D.get('spec20');
    if (spec) {
        const cuvObj = findObjectById('cuvette');
        const wantLidOpen =
            animState.dropHoverId === 'spec20' ||
            (animState.draggedId === 'cuvette' && cuvObj?.isInSpec) ||
            (animState.activeChoreo?.kind === 'insertCuvette' && animState.activeChoreo.elapsed < 0.50) ||
            (animState.activeChoreo?.kind === 'emptyCuvette' && animState.activeChoreo.elapsed < 0.25) ||
            animState.lidTarget > 0.5;

        animState.lidOpen += ((wantLidOpen ? 1 : 0) - animState.lidOpen) * Math.min(1, dt * 11);
        if (spec.lidPivot) {
            // Rotate hinged lid backward open cleanly (-92 deg around local X)
            spec.lidPivot.rotation.x = -animState.lidOpen * (Math.PI * 0.52);
        }

        // Physical tactile button depression & step guidance glow
        const highlights = state.highlights || [];
        Object.entries(spec.btnNodes).forEach(([btnKey, node]) => {
            if (!node) return;
            animState.btnPress[btnKey] = Math.max(0, animState.btnPress[btnKey] - dt * 5.2);
            const pressDepth = Math.sin(animState.btnPress[btnKey] * Math.PI) * 0.0045;
            node.position.z = spec.btnRestZ[btnKey] - pressDepth;

            const isBtnHighlighted = highlights.includes(`btn_${btnKey}`);
            node.traverse((ch) => {
                if (ch.isMesh && ch.name.includes('_Face') && ch.material) {
                    const pulse = isBtnHighlighted ? 0.55 + 0.45 * Math.sin(now * 5.0) : 0.14;
                    ch.material.emissiveIntensity = pulse;
                }
            });
        });

        // 630 nm ruby beam LED flash during zero/measure
        if (animState.beamFlash > 0) {
            animState.beamFlash = Math.max(0, animState.beamFlash - dt * 1.4);
            updateSpecDisplayTexture(state.spec20State);
        }
        if (spec.beamLed && spec.beamLed.material) {
            spec.beamLed.material.emissiveIntensity = 1.6 + animState.beamFlash * 8.0;
        }
    }

    // 5. Choreographed Action Animations (Fill, Dispense, Insert Cuvette, Pour Waste)
    pourStreamMesh.visible = false;
    if (animState.activeChoreo) {
        const ch = animState.activeChoreo;
        ch.elapsed += dt;
        const t = Math.min(1, ch.elapsed / ch.duration);
        const actor = objects3D.get(ch.actorId);

        if (actor && ch.kind === 'fillPipette') {
            if (t < 0.20) {
                const u = smoothstep(0, 0.20, t);
                actor.root.position.lerpVectors(ch.startPos, ch.hoverPos, u);
            } else if (t < 0.42) {
                const u = smoothstep(0.20, 0.42, t);
                actor.root.position.lerpVectors(ch.hoverPos, ch.dipPos, u);
                if (actor.bulb) actor.bulb.scale.set(0.84, 1.0, 0.84);
            } else if (t < 0.66) {
                actor.root.position.copy(ch.dipPos);
                // Rubber bulb visibly expands as liquid aspirates!
                const u = smoothstep(0.42, 0.66, t);
                const sx = 0.84 + 0.16 * u;
                if (actor.bulb) actor.bulb.scale.set(sx, 1.0, sx);
            } else if (t < 0.82) {
                // Lift straight out of vessel neck cleanly without clipping glass rim
                const u = smoothstep(0.66, 0.82, t);
                actor.root.position.lerpVectors(ch.dipPos, ch.hoverPos, u);
            } else {
                // Glide smoothly to hand-ready poised position right in front of source vessel (NOT back to stand!)
                const u = smoothstep(0.82, 1.0, t);
                actor.root.position.lerpVectors(ch.hoverPos, ch.endPos, u);
            }
            actor.root.rotation.set(0, actor.homeRotY, 0);
        } else if (actor && ch.kind === 'dispensePipette') {
            if (t < 0.28) {
                const u = smoothstep(0, 0.28, t);
                actor.root.position.lerpVectors(ch.startPos, ch.dispensePos, u);
            } else if (t < 0.72) {
                actor.root.position.copy(ch.dispensePos);
                const u = smoothstep(0.28, 0.72, t);
                const squeeze = 1.0 - 0.18 * Math.sin(u * Math.PI);
                if (actor.bulb) actor.bulb.scale.set(squeeze, 1.0, squeeze);

                // Render shimmering Beer-Lambert liquid delivery stream from pipette tip into target!
                const streamLen = Math.max(0.01, ch.dispensePos.y - ch.streamTargetY);
                pourStreamMesh.position.copy(ch.dispensePos);
                pourStreamMesh.scale.set(1, streamLen, 1);
                if (ch.streamStyle) {
                    pourStreamMat.color.copy(ch.streamStyle.color);
                    pourStreamMat.emissive.copy(ch.streamStyle.emissive);
                    pourStreamMat.emissiveIntensity = ch.streamStyle.emissiveIntensity;
                    pourStreamMat.opacity = Math.max(0.16, Math.min(0.84, ch.streamStyle.opacity + 0.12));
                    if (pourStreamMat.userData?.uIsClearWater) {
                        pourStreamMat.userData.uIsClearWater.value = ch.streamStyle.isClearWater ? 1.0 : 0.0;
                    }
                }
                pourStreamMesh.visible = true;
            } else {
                const u = smoothstep(0.72, 1.0, t);
                actor.root.position.lerpVectors(ch.dispensePos, ch.endPos, u);
                if (actor.bulb) actor.bulb.scale.set(1, 1, 1);
            }
            actor.root.rotation.set(0, actor.homeRotY, 0);
        } else if (actor && ch.kind === 'insertCuvette') {
            if (t < 0.48) {
                const u = smoothstep(0, 0.48, t);
                actor.root.position.lerpVectors(ch.startPos, ch.aboveSlot, u);
                actor.root.position.y += Math.sin(u * Math.PI) * 0.04;
            } else {
                const u = smoothstep(0.48, 1.0, t);
                actor.root.position.lerpVectors(ch.aboveSlot, ch.endPos, u);
            }
            actor.root.rotation.set(0, ch.endRotY, 0);
        } else if (actor && ch.kind === 'emptyCuvette') {
            if (t < 0.28) {
                const u = smoothstep(0, 0.28, t);
                actor.root.position.lerpVectors(ch.startPos, ch.pourPos, u);
                actor.root.position.y += Math.sin(u * Math.PI) * 0.05;
                actor.root.rotation.z = -u * 0.3;
            } else if (t < 0.72) {
                const u = smoothstep(0.28, 0.72, t);
                actor.root.position.copy(ch.pourPos);
                // Tilt cuvette to pour cleanly from its open mouth into the waste beaker!
                const tilt = Math.sin(u * Math.PI) * 2.05;
                actor.root.rotation.set(0, 0, -tilt);

                if (u > 0.20 && u < 0.80) {
                    // Exact world coordinate of the tilted cuvette's open upper lip (local (0.006, 0.065, 0))
                    const sinT = Math.sin(tilt);
                    const cosT = Math.cos(tilt);
                    const lx = 0.006;
                    const ly = 0.065;
                    _pourMouthVec.set(
                        ch.pourPos.x + lx * cosT + ly * sinT,
                        ch.pourPos.y - lx * sinT + ly * cosT,
                        ch.pourPos.z
                    );
                    const len = Math.max(0.02, _pourMouthVec.y - ch.streamTargetY);
                    pourStreamMesh.position.copy(_pourMouthVec);
                    pourStreamMesh.scale.set(1.25, len, 1.25);
                    if (ch.streamStyle) {
                        pourStreamMat.color.copy(ch.streamStyle.color);
                        pourStreamMat.emissive.copy(ch.streamStyle.emissive);
                        pourStreamMat.emissiveIntensity = ch.streamStyle.emissiveIntensity;
                        pourStreamMat.opacity = Math.max(0.16, Math.min(0.84, ch.streamStyle.opacity + 0.12));
                        if (pourStreamMat.userData?.uIsClearWater) {
                            pourStreamMat.userData.uIsClearWater.value = ch.streamStyle.isClearWater ? 1.0 : 0.0;
                        }
                    }
                    pourStreamMesh.visible = true;
                }
            } else {
                const u = smoothstep(0.72, 1.0, t);
                actor.root.position.lerpVectors(ch.pourPos, ch.endPos, u);
                actor.root.rotation.set(0, actor.homeRotY, 0);
            }
        }

        if (t >= 1.0) {
            if (actor?.bulb) actor.bulb.scale.set(1, 1, 1);
            animState.activeChoreo = null;
        }
    }

    // 6. Idle / Selected / Loaded Resting Positions for Draggable Objects
    ['pipette_stock', 'pipette_water', 'pipette_unknown', 'cuvette'].forEach((id) => {
        if (animState.draggedId === id) return;
        if (animState.activeChoreo?.actorId === id) return;

        const entry = objects3D.get(id);
        const obj = findObjectById(id);
        if (!entry || !obj) return;

        let targetPos = entry.homePos.clone();
        let targetRotY = entry.homeRotY;

        if (id === 'cuvette' && obj.isInSpec) {
            const specXform = getSpecCuvetteWorldTransform();
            targetPos.copy(specXform.pos);
            targetRotY = specXform.rotY;
            if (state.selectedObjectId === id) {
                targetPos.y += 0.065; // Lift partially out of open chamber when selected
                animState.lidTarget = 1.0;
            }
        } else {
            // Loaded pipettes stay poised right above their source vessel (ready to go straight to tube/cuvette!)
            if (obj.type === 'pipette' && obj.currentVolume > 0) {
                const holdPos = animState.loadedHoldPos.get(id);
                if (holdPos) {
                    targetPos.copy(holdPos);
                    targetPos.y += Math.sin(now * 3.8) * 0.004;
                    if (state.selectedObjectId === id) {
                        targetPos.y += 0.010;
                    }
                } else {
                    targetPos.y += 0.036 + Math.sin(now * 3.4) * 0.004;
                    if (state.selectedObjectId === id) {
                        targetPos.y += 0.018;
                    }
                }
            } else {
                if (obj.type === 'pipette') animState.loadedHoldPos.delete(id);
                if (state.selectedObjectId === id) {
                    targetPos.y += 0.045 + Math.sin(now * 5.0) * 0.005;
                }
            }
        }

        entry.root.position.lerp(targetPos, damp);
        entry.root.rotation.x += (0 - entry.root.rotation.x) * damp;
        entry.root.rotation.z += (0 - entry.root.rotation.z) * damp;
        entry.root.rotation.y += (targetRotY - entry.root.rotation.y) * damp;
    });

    // 7. Actively Dragged 3D Object Smoothing (Crisp 1:1 cursor tracking even under CPU load!)
    if (animState.draggedId) {
        const entry = objects3D.get(animState.draggedId);
        if (entry) {
            entry.root.position.lerp(animState.dragWorldPos, Math.min(1, dt * 38));
            entry.root.rotation.z += (0 - entry.root.rotation.z) * damp;
        }
    }

    // 8. Highlight Beacons (Amber Step Guidance vs Emerald Active Drop Target)
    const highlights = state.highlights || [];
    for (const [id, entry] of objects3D.entries()) {
        if (!entry.beacon) continue;
        // Never float a ground halo ring in mid-air beneath an actively dragged, animated, or hovering loaded pipette/cuvette!
        if (animState.draggedId === id || animState.activeChoreo?.actorId === id || animState.loadedHoldPos.has(id)) {
            entry.beacon.visible = false;
            continue;
        }
        const isDropHover = animState.dropHoverId === id;
        const isSelected = state.selectedObjectId === id;
        const isStepHighlight = highlights.includes(id);

        if (isDropHover) {
            entry.beacon.visible = true;
            entry.beacon.material.color.setHex(0x22c55e);
            entry.beacon.material.opacity = 0.85;
            const s = 1.06 + 0.08 * Math.sin(now * 8.0);
            entry.beacon.scale.set(s, s, s);
        } else if (isSelected) {
            entry.beacon.visible = true;
            entry.beacon.material.color.setHex(0x38bdf8);
            entry.beacon.material.opacity = 0.85;
            entry.beacon.scale.set(1.08, 1.08, 1.08);
        } else if (isStepHighlight) {
            entry.beacon.visible = true;
            entry.beacon.material.color.setHex(0xf59e0b);
            entry.beacon.material.opacity = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(now * 4.5));
            const s = 1.0 + 0.06 * Math.sin(now * 4.5);
            entry.beacon.scale.set(s, s, s);
        } else {
            entry.beacon.visible = false;
        }
    }
}

// ---------------------------------------------------------------------------
// External Hooks Used by interaction3d.js
// ---------------------------------------------------------------------------

export function setCameraPreset(presetKey) {
    const preset = config.CAMERA_PRESETS[presetKey];
    if (!preset || !camera || !controls) return;
    animState.cameraFlight = {
        elapsed: 0,
        duration: 0.55,
        fromPos: camera.position.clone(),
        toPos: new THREE.Vector3(...preset.pos),
        fromTarget: controls.target.clone(),
        toTarget: new THREE.Vector3(...preset.target),
    };
}

export function setDragVisualState(draggedId, worldPos = null, dropHoverId = null) {
    // If user grabs an apparatus mid-choreography (e.g., dragging a pipette immediately after aspirating), yield smoothly to hand!
    if (draggedId && animState.activeChoreo?.actorId === draggedId) {
        const actor = objects3D.get(draggedId);
        if (actor?.bulb) actor.bulb.scale.set(1, 1, 1);
        animState.activeChoreo = null;
    }
    animState.draggedId = draggedId;
    animState.dropHoverId = dropHoverId;
    if (worldPos) {
        animState.dragWorldPos.copy(worldPos);
    }
    // Automatically open bottle cap if dragging/hovering a pipette over that bottle!
    if (draggedId && draggedId.startsWith('pipette_') && dropHoverId && dropHoverId.endsWith('Bottle')) {
        animState.capHoverTarget = dropHoverId;
    } else {
        animState.capHoverTarget = null;
    }
}

export function getPickTargets() {
    return pickTargets;
}

export function getObject3D(id) {
    return objects3D.get(id) || null;
}

export function getCamera() {
    return camera;
}

export function getControls() {
    return controls;
}

export function getDomElement() {
    return renderer?.domElement || null;
}

export function getScreenPoint(interactId) {
    if (!camera || !renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const worldPos = new THREE.Vector3();

    if (interactId.startsWith('btn_')) {
        const spec = objects3D.get('spec20');
        const key = interactId.replace('btn_', '');
        const node = spec?.btnNodes?.[key];
        if (!node) return null;
        node.updateWorldMatrix(true, false);
        node.getWorldPosition(worldPos);
    } else {
        const entry = objects3D.get(interactId);
        if (!entry) return null;
        entry.root.updateWorldMatrix(true, false);
        const yOffsets = {
            pipette: 0.15,
            bottle: 0.09,
            testTube: 0.095,
            cuvette: 0.036,
            beaker: 0.055,
            spectrophotometer: 0.12,
        };
        const localPt = new THREE.Vector3(
            entry.type === 'spectrophotometer' ? entry.slotLocal.x : 0,
            yOffsets[entry.type] ?? 0.08,
            entry.type === 'spectrophotometer' ? entry.slotLocal.z : 0
        );
        worldPos.copy(localPt).applyMatrix4(entry.root.matrixWorld);
    }

    worldPos.project(camera);
    return {
        x: rect.left + (worldPos.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-worldPos.y * 0.5 + 0.5) * rect.height,
    };
}
