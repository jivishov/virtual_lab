# Virtual Laboratory Website

A professional, educational frontpage for hosting virtual laboratory simulations and interactive science experiments.

## Features

- **Modern Card-Based Layout**: Clean, professional design with card-style presentation for each lab
- **Responsive Design**: Optimized for all devices (desktop, tablet, mobile)
- **Smooth Animations**: Professional fade-in effects and hover interactions
- **Accessibility**: Keyboard navigation and screen reader friendly
- **Easy to Customize**: Simple data structure for adding new labs

## Files Structure

```
virtual_lab/
├── index.html          # Main HTML structure
├── styles.css          # All styling and animations
├── script.js           # Interactive functionality and lab data
└── README.md          # This file
```

## How to Use

1. **Open the website**: Simply open `index.html` in a web browser
2. **View labs**: Browse through the available virtual labs and simulations
3. **Launch a lab**: Click on any "Launch Lab" or "Launch Simulation" button

## Adding New Labs

To add a new virtual lab to the website:

1. Open `script.js`
2. Find the `labs` array at the top of the file
3. Add a new lab object following this format:

```javascript
{
    id: 5,                              // Unique ID number
    title: "Your Lab Title",            // Lab name
    description: "Lab description...",   // Brief description
    type: "lab",                        // "lab" or "simulation"
    icon: "🔬",                         // Emoji icon
    tags: ["Tag1", "Tag2"],             // Category tags
    link: "/path/to/lab.html"           // Link to your lab file
}
```

### Example:

```javascript
{
    id: 5,
    title: "Titration Experiment",
    description: "Learn acid-base titration techniques and calculations",
    type: "lab",
    icon: "🧪",
    tags: ["Chemistry", "Acid-Base", "Titration"],
    link: "./labs/titration.html"
}
```

## Customization

### Colors
Edit the CSS variables in `styles.css` (lines 11-30) to change the color scheme:

```css
--primary-color: #2563eb;      /* Main blue color */
--secondary-color: #7c3aed;    /* Purple for simulations */
--accent-color: #06b6d4;       /* Accent color */
```

### Icons
You can use any emoji as an icon, or replace with image files:
- 🔬 Microscope (general lab)
- 🧬 DNA (genetics/biology)
- ⚗️ Alembic (chemistry)
- ⚛️ Atom (physics/nuclear)
- 🧪 Test tube (chemistry)
- 🔭 Telescope (astronomy)

### Header Text
Edit the header content in `index.html` (lines 13-14):

```html
<h1 class="main-title">Virtual Laboratory</h1>
<p class="subtitle">Explore interactive science simulations and experiments</p>
```

## Current Labs

1. **Spectrophotometry: Blue Dye Analysis** (Lab)
   - Determine concentration of blue dye in sports drinks
   - Topics: Beer's Law, calibration curves

2. **DNA Microarray** (Lab)
   - Gene expression analysis
   - Topics: Genetics, molecular biology

3. **Copper in Brass Analysis** (Lab)
   - Quantitative analysis of copper content
   - Topics: Spectrophotometry, metallurgy

4. **Nuclear Chemistry Game** (Simulation)
   - Interactive nuclear chemistry exploration
   - Topics: Nuclear reactions, radioactive decay

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design

## Tips

- **Update Links**: Remember to update the `link` property in each lab object when your lab files are ready
- **Image Backgrounds**: You can add custom background images to lab cards by modifying the `.lab-card-header` CSS
- **Custom Fonts**: Add Google Fonts or custom fonts by linking them in `index.html`
- **Analytics**: Add Google Analytics or other tracking by inserting the script in `index.html`

## License

See LICENSE file for details.
