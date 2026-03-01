const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputFolder = __dirname;

// Find the input image
function findInputImage() {
    const files = fs.readdirSync(inputFolder);
    
    // Look for common image formats
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
    
    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (imageExtensions.includes(ext)) {
            console.log(`✅ Found image: ${file}`);
            return file;
        }
    }
    
    return null;
}

async function generateIcons() {
    console.log('========================================');
    console.log('    ICON GENERATOR FOR CLEARANCE APP');
    console.log('========================================\n');
    
    console.log(`Working directory: ${inputFolder}\n`);
    
    // Find input image
    const inputImage = findInputImage();
    
    if (!inputImage) {
        console.error('❌ No image file found!');
        console.error('Please place an image (PNG, JPG, etc.) in this folder.');
        return;
    }
    
    const inputPath = path.join(inputFolder, inputImage);
    
    console.log(`\nGenerating icons from: ${inputImage}`);
    console.log('----------------------------------------\n');
    
    let successCount = 0;
    
    for (const size of sizes) {
        const outputFile = `icon-${size}x${size}.png`;
        const outputPath = path.join(inputFolder, outputFile);
        
        process.stdout.write(`Creating ${outputFile}... `);
        
        try {
            await sharp(inputPath)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 }
                })
                .png()
                .toFile(outputPath);
            
            console.log('✅');
            successCount++;
        } catch (error) {
            console.log('❌');
            console.error(`   Error: ${error.message}`);
        }
    }
    
    console.log('\n----------------------------------------');
    console.log(`✅ Generated ${successCount} of ${sizes.length} icons successfully!`);
    
    if (successCount > 0) {
        console.log('\nFiles created:');
        const files = fs.readdirSync(inputFolder)
            .filter(f => f.startsWith('icon-') && f.endsWith('.png'))
            .sort();
        
        files.forEach(f => console.log(`  📁 ${f}`));
    }
    
    console.log('\nPress any key to exit...');
}

// Run the generator
generateIcons().catch(console.error);