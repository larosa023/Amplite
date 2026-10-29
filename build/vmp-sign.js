// Optional castLabs VMP signing (lets Spotify's DRM trust the app so music plays inside Amplite).
// Runs only when the castLabs EVS tool is installed and you're logged in:
//   pip install --upgrade castlabs-evs
//   python -m castlabs_evs.account signup     (free, once)
// In GitHub Actions, set repo secrets EVS_ACCOUNT_NAME and EVS_PASSWD.
const { execSync } = require('child_process');

exports.default = async function (context) {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  try { execSync(`${py} -c "import castlabs_evs"`, { stdio: 'ignore' }); }
  catch { console.log('  • VMP signing skipped (castlabs-evs not installed)'); return; }
  try {
    if (process.env.EVS_ACCOUNT_NAME && process.env.EVS_PASSWD) {
      execSync(`${py} -m castlabs_evs.account reauth -A "${process.env.EVS_ACCOUNT_NAME}" -P "${process.env.EVS_PASSWD}"`, { stdio: 'inherit' });
    }
    execSync(`${py} -m castlabs_evs.vmp sign-pkg "${context.appOutDir}"`, { stdio: 'inherit' });
    console.log('  • VMP signed');
  } catch (e) {
    console.warn('  • VMP signing failed:', e.message);
  }
};
