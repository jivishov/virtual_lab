# Mission: Impossible - Laboratory Protocol

An immersive, Mission: Impossible themed lab safety training simulator featuring realistic animations, sound effects, and interactive scenarios.

## Features

- **10 Mission Scenarios** covering critical lab safety protocols
- **Realistic Animations**: Beaker explosions, fire effects, chemical reactions, particle systems
- **MI Theme**: Spy-themed interface with briefings, countdowns, and self-destruct sequences
- **Audio Integration**: Background music, sound effects (beeps, explosions, alarms)
- **Badge System**: Earn commendations for speed, accuracy, and safety expertise
- **Agent Levels**: Choose from Recruit, Field Agent, Special Ops, or IMF Director
- **Timed Challenges**: 15-second timer for each scenario with visual/audio warnings
- **Educational Content**: Detailed explanations for each safety protocol

## Topics Covered

1. **PPE Checkpoint** - Proper protective equipment selection
2. **Chemical Identification** - Hazard symbol recognition
3. **Fire Protocol** - Emergency response for clothing fires
4. **Contamination Alert** - Chemical spill procedures
5. **Mixing Protocol** - Acid/water dilution safety (CRITICAL)
6. **Lab Responsibility** - Cleanup and shared duties
7. **Flammable Materials** - Safe storage practices
8. **Access Control** - Laboratory entry authorization
9. **Behavior Protocol** - Prohibited activities
10. **Biological Hazards** - Sample handling safety

## Audio Files

The simulator uses Web Audio API fallbacks for sound effects, but for the best experience, add these optional audio files to `assets/audio/`:

- `mi-theme.mp3` - Mission: Impossible theme (royalty-free version)
- `beep.mp3` - Timer beep sound
- `explosion.mp3` - Self-destruct explosion
- `success.mp3` - Correct answer chime
- `fail.mp3` - Incorrect answer buzz
- `alarm.mp3` - Emergency alert siren

**Note**: The game works perfectly without these files using synthesized Web Audio sounds.

## Technologies Used

- **HTML5** - Semantic structure
- **CSS3** - Advanced animations, gradients, particle effects
- **Vanilla JavaScript** - Game engine, state management
- **Web Audio API** - Fallback sound synthesis
- **CSS Keyframe Animations** - Smooth, realistic effects

## How to Use

1. Open `index.html` in a modern browser
2. Enter your agent codename
3. Read the mission briefing (watch the self-destruct!)
4. Select your clearance level
5. Complete 10 lab safety scenarios
6. Earn badges and achieve the highest rank

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design

## Learning Objectives

Students will learn:
- Critical lab safety protocols
- Emergency response procedures
- Proper PPE usage
- Chemical handling techniques
- Lab behavior expectations
- Hazard identification

## Scoring

- **Base Points**: 10 per correct answer
- **Streak Bonus**: +5 for 3+ consecutive correct
- **Speed Bonus**: +5 for answers under 8 seconds
- **Penalties**: -5 for incorrect answers

## Badges

- ⚡ **Speed Operative** - 5 quick answers
- 🏆 **Perfect Protocol** - All correct
- 🛡️ **Safety Specialist** - All emergency scenarios correct
- 🔥 **Streak Master** - 5+ consecutive correct

## Credits

Created for Virtual Lab educational platform
Designed with realistic animations prioritized for engaging learning experience

---

**Remember**: In a real lab, safety is not a game. Always follow your instructor's protocols!
