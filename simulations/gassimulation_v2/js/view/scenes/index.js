import { createSyringe } from './syringe.js';
import { createBalloonBath } from './balloonBath.js';
import { createHotAirBalloon } from './hotAirBalloon.js';
import { createPressureCooker } from './pressureCooker.js';
import { createCarTire } from './carTire.js';
import { createPartyBalloon } from './partyBalloon.js';
import { createScubaTank } from './scubaTank.js';

/** Each factory takes { stage, preset } and returns the scene object main.js drives. */
export const SCENES = {
  syringe: createSyringe,
  hotAirBalloon: createHotAirBalloon,
  balloonBath: createBalloonBath,
  pressureCooker: createPressureCooker,
  carTire: createCarTire,
  partyBalloon: createPartyBalloon,
  scubaTank: createScubaTank,
};
