const fs = require('fs');
const path = require('path');

const chmodIfExists = (target) => {
  if (!target || !fs.existsSync(target)) {
    return;
  }
  try {
    fs.chmodSync(target, 0o755);
  } catch (error) {
    console.warn(`after-pack: failed to chmod ${target}: ${error.message}`);
  }
};

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const resources = path.join(context.appOutDir, appName, 'Contents', 'Resources');
  const candidates = [
    path.join(resources, 'sox', 'sox'),
    path.join(resources, 'fw_runner.py'),
    path.join(resources, 'faster-whisper', 'venv', 'bin', 'python'),
    path.join(resources, 'faster-whisper', 'venv', 'bin', 'python3'),
    path.join(resources, 'faster-whisper', 'venv', 'bin', 'python3.11')
  ];

  candidates.forEach(chmodIfExists);
};
