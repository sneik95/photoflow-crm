(()=>{'use strict';const ID='pf-swipe-pastel-fix-style';function install(){let s=document.getElementById(ID);if(!s){s=document.createElement('style');s.id=ID;document.head.appendChild(s)}s.textContent=`
/* PhotoFlow: swipe actions — centered labels + softer pastel palette */
.pf-edit-actions{width:170px!important;grid-template-columns:85px 85px!important;align-items:stretch!important}
.pf-edit-action{display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;padding:0 8px!important;margin:0!important;box-sizing:border-box!important;line-height:1.15!important;font-size:13px!important;font-weight:650!important;white-space:nowrap!important;overflow:hidden!important}
.pf-edit-action.edit{background:#DCE2FF!important;color:#4258D8!important}
.pf-edit-action.delete{background:#F8D9D6!important;color:#B6534C!important}
.pf-swipe-action{background:#DDF1E8!important;color:#2F7F67!important}
`;}
install();new MutationObserver(()=>{if(!document.getElementById(ID))install()}).observe(document.documentElement,{childList:true,subtree:true});})();