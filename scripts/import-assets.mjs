// Copies the Astra design package into public/assets.
// Usage: node scripts/import-assets.mjs "<path to Monkey-Brewery-Redesign-v2>"
// Storyboard frames are cropped to the scene area (the mock Skip/Mute buttons
// and captions in the frames are replaced by real controls in the game).
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2] ?? '../Monkey-Brewery-Redesign-v2';
const out = path.resolve('public/assets');
if (!fs.existsSync(src)) {
  console.error(`Design folder not found: ${src}`);
  process.exit(1);
}

const copyDir = (sub, filter = () => true, transform) => {
  const from = path.join(src, sub);
  if (!fs.existsSync(from)) return 0;
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const p = path.join(from, entry.name);
    if (entry.isDirectory()) {
      n += copyDir(path.join(sub, entry.name), filter, transform);
      continue;
    }
    if (!filter(entry.name)) continue;
    const dest = path.join(out, sub, entry.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (transform) fs.writeFileSync(dest, transform(fs.readFileSync(p, 'utf8'), entry.name));
    else fs.copyFileSync(p, dest);
    n++;
  }
  return n;
};

const svg = (name) => name.endsWith('.svg') && !name.startsWith('character-sheet');
// Scene area inside every 1440x900 storyboard frame.
const cropStoryboard = (text) =>
  text.replace(
    /<svg([^>]*?)width="1440" height="900" viewBox="0 0 1440 900"/,
    '<svg$1width="1376" height="593" viewBox="32 106 1376 593" preserveAspectRatio="xMidYMid slice"',
  );

let total = 0;
total += copyDir('characters', svg);
total += copyDir('rooms', svg);
total += copyDir('props', svg);
total += copyDir('icons', svg);
total += copyDir('storyboards', (n) => n.endsWith('.svg') && !n.includes('_sheet'), cropStoryboard);
const wave = path.join(src, 'motion', 'bruno_wave_animated.svg');
if (fs.existsSync(wave)) { fs.mkdirSync(path.join(out, 'characters'), { recursive: true }); fs.copyFileSync(wave, path.join(out, 'characters', 'bruno_wave_animated.svg')); total++; }
console.log(`Imported ${total} files into ${out}`);
