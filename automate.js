const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function run() {
    try {
        console.log('--- STEP 1: BUILDING APK ---');
        const appDir = path.join(__dirname, 'teenpatti_app');
        console.log(`Navigating to ${appDir}...`);
        
        console.log('Running flutter pub get...');
        execSync('C:\\src\\flutter\\bin\\flutter.bat pub get', { cwd: appDir, stdio: 'inherit' });
        
        console.log('Running flutter build apk --release...');
        execSync('C:\\src\\flutter\\bin\\flutter.bat build apk --release', { cwd: appDir, stdio: 'inherit' });

        console.log('\n--- STEP 2: COPYING APK TO SERVER ---');
        const apkSrc = path.join(appDir, 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');
        const publicDir = path.join(__dirname, 'server', 'public');
        const apkDest = path.join(publicDir, 'app-release.apk');
        
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        
        if (fs.existsSync(apkSrc)) {
            fs.copyFileSync(apkSrc, apkDest);
            console.log('APK copied successfully to server/public/');
        } else {
            throw new Error('APK source file not found! Ensure you have Flutter installed and the build was successful.');
        }

        console.log('\n--- STEP 3: INSTALLING SERVER DEPENDENCIES ---');
        const serverDir = path.join(__dirname, 'server');
        console.log('Running npm install...');
        // Using 'npm.cmd' for Windows compatibility in execSync
        const npmCmd = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
        execSync(`${npmCmd} install`, { cwd: serverDir, stdio: 'inherit' });

        console.log('\n--- STEP 4: DETECTING LOCAL IP ---');
        const networkInterfaces = os.networkInterfaces();
        let localIp = 'localhost';
        
        for (const interfaceName in networkInterfaces) {
            for (const iface of networkInterfaces[interfaceName]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    localIp = iface.address;
                    break;
                }
            }
        }

        console.log('\n--- STEP 5: STARTING SERVER ---');
        const serverProcess = spawn('node', ['server.js'], { 
            cwd: serverDir,
            stdio: 'inherit',
            detached: true
        });

        console.log('\n=========================================');
        console.log('SUCCESS: Teen Patti Project is Live!');
        console.log(`Local Dashboard: http://localhost:4000`);
        console.log(`Direct APK Download: http://${localIp}:4000/app-release.apk`);
        console.log('=========================================');

    } catch (error) {
        console.error('\n❌ ERROR DURING AUTOMATION:');
        console.error(error.message);
        process.exit(1);
    }
}

run();
