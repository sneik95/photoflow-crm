#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

command -v timeout || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

echo "Running bounded vinext build..."
timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build

# The public PhotoFlow client is versioned in sneik95/photoflow-crm. Keep the
# Sites worker/API build intact, then publish the exact validated client bundle.
upstream_client="${SITES_PROJECT_ROOT}/deployment/github-main-c5305ce"
test -f "${upstream_client}/index.html"
test -d "${upstream_client}/assets"
cp "${upstream_client}/index.html" "${SITES_PROJECT_ROOT}/dist/client/index.html"
cp -R "${upstream_client}/assets/." "${SITES_PROJECT_ROOT}/dist/client/assets/"

# Vinext hydrates the complete document. Loading DOM-patching runtime scripts in
# <head> changes that document before hydration and can leave Safari with a
# blank page. Keep the upstream bundle intact, but load those optional runtime
# enhancements only after the application has hydrated.
node - "${SITES_PROJECT_ROOT}/dist/client/index.html" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
let html = fs.readFileSync(file, 'utf8');
const injectedHead = /\n<link rel="stylesheet" href="\/assets\/photoflow-hotfix-01\.css\?v=20260830-stability2"\/>\n<script src="\/assets\/photoflow-runtime-v2\.js\?v=20260830-stability2"><\/script>\n<script defer src="\/assets\/photoflow-risk-modal-fix\.js\?v=20260830-stability2"><\/script>\n/;
if (!injectedHead.test(html)) throw new Error('Expected PhotoFlow runtime injection was not found.');
html = html.replace(injectedHead, '\n');
html += `\n<script>(function(){var loaded=false;function start(){if(loaded)return;loaded=true;requestAnimationFrame(function(){requestAnimationFrame(function(){var css=document.createElement('link');css.rel='stylesheet';css.href='/assets/photoflow-hotfix-01.css?v=20260830-startup1';var runtime=document.createElement('script');runtime.src='/assets/photoflow-runtime-v2.js?v=20260830-startup1';runtime.onload=function(){document.documentElement.classList.remove('pf-booting');var risk=document.createElement('script');risk.src='/assets/photoflow-risk-modal-fix.js?v=20260830-startup1';risk.defer=true;document.head.appendChild(risk);requestAnimationFrame(function(){requestAnimationFrame(function(){if(window.PhotoFlowData&&window.PhotoFlowData.bootstrap)window.PhotoFlowData.bootstrap().catch(function(){});});});};document.head.appendChild(css);document.head.appendChild(runtime);});});}if(window.__VINEXT_HYDRATED_AT!==undefined){start();return;}var value;try{Object.defineProperty(window,'__VINEXT_HYDRATED_AT',{configurable:true,enumerable:true,get:function(){return value;},set:function(next){value=next;Object.defineProperty(window,'__VINEXT_HYDRATED_AT',{configurable:true,enumerable:true,writable:true,value:next});start();}});}catch(_){window.addEventListener('load',start,{once:true});}})();</script>\n`;
fs.writeFileSync(file, html);
NODE
