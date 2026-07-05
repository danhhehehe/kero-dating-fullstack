import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const PHOTOS_PER_USER = 3;
const OUTPUT_EXTENSION = ".jpg";

const backendSrcDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(backendSrcDir, "..");
const projectRoot = path.resolve(backendDir, "..");
const extractedDir = path.join(projectRoot, "Dating");
const zipPath = path.join(projectRoot, "Dating.zip");
const outputDir = path.join(projectRoot, "frontend", "public", "dating-demo");
const generatedDir = path.join(backendSrcDir, "generated");
const mappingPath = path.join(generatedDir, "datingDemoUsers.json");

function collectImages(dir) {
  const found = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension)) continue;

      found.push({
        fullPath,
        relativePath: path.relative(dir, fullPath).replace(/\\/g, "/")
      });
    }
  }

  return found.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "en", { numeric: true }));
}

function ensureExtractedSource() {
  if (fs.existsSync(extractedDir) && fs.statSync(extractedDir).isDirectory()) return;

  if (fs.existsSync(zipPath)) {
    throw new Error(
      [
        "Dating.zip was found, but this script does not add a zip library to the project.",
        "Please extract it first, then run this command again:",
        "",
        "PowerShell:",
        "  Expand-Archive -LiteralPath ..\\Dating.zip -DestinationPath ..\\Dating -Force",
        "",
        "Expected source folder:",
        `  ${extractedDir}`
      ].join("\n")
    );
  }

  throw new Error(`No source images found. Put extracted images in ${extractedDir} or add Dating.zip to the project root.`);
}

function cleanOutputDir() {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXTENSIONS.has(extension) || extension === OUTPUT_EXTENSION) {
      fs.unlinkSync(path.join(outputDir, entry.name));
    }
  }
}

function makeDemoUsers(images) {
  const fullGroups = Math.floor(images.length / PHOTOS_PER_USER);
  const users = [];

  for (let groupIndex = 0; groupIndex < fullGroups; groupIndex += 1) {
    const userNumber = String(groupIndex + 1).padStart(2, "0");
    const prefix = `q${userNumber}`;
    const photos = [];

    for (let photoIndex = 0; photoIndex < PHOTOS_PER_USER; photoIndex += 1) {
      const image = images[groupIndex * PHOTOS_PER_USER + photoIndex];
      const photoNumber = String(photoIndex + 1).padStart(2, "0");
      const fileName = `${prefix}_${photoNumber}${OUTPUT_EXTENSION}`;
      fs.copyFileSync(image.fullPath, path.join(outputDir, fileName));
      photos.push(`/dating-demo/${fileName}`);
    }

    users.push({
      name: `Q${userNumber}`,
      photos
    });
  }

  return users;
}

function main() {
  ensureExtractedSource();

  const images = collectImages(extractedDir);
  if (images.length < PHOTOS_PER_USER) {
    throw new Error(`Need at least ${PHOTOS_PER_USER} images. Found ${images.length}.`);
  }

  const remainder = images.length % PHOTOS_PER_USER;
  cleanOutputDir();
  fs.mkdirSync(generatedDir, { recursive: true });

  const users = makeDemoUsers(images);
  fs.writeFileSync(mappingPath, `${JSON.stringify(users, null, 2)}\n`, "utf8");

  console.log(`Found ${images.length} image(s).`);
  console.log(`Created ${users.length} demo user(s).`);
  if (remainder) console.log(`Ignored ${remainder} extra image(s) that did not make a full group of 3.`);
  console.log(`Copied images to ${outputDir}`);
  console.log(`Wrote ${mappingPath}`);
}

main();
