(()=>{'use strict';const ID='pf-swipe-pastel-fix-style';function install(){let s=document.getElementById(ID);if(!s){s=document.createElement('style');s.id=ID;document.head.appendChild(s)}s.textContent=`
/* PhotoFlow: swipe actions must match the 150px reveal used by the gesture code */
.pf-edit-actions{position:absolute!important;right:0!important;left:auto!important;top:0!important;bottom:0!important;width:150px!important;min-width:150px!important;max-width:150px!important;display:grid!important;grid-template-columns:75px 75px!important;align-items:stretch!important;transform:none!important;margin:0!important;padding:0!important;overflow:hidden!important;box-sizing:border-box!important}
.pf-edit-action{position:relative!important;inset:auto!important;width:75px!important;min-width:75px!important;max-width:75px!important;height:100%!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;padding:0!important;margin:0!important;box-sizing:border-box!important;line-height:1!important;font-size:10.5px!important;font-weight:700!important;white-space:nowrap!important;overflow:hidden!important;text-indent:0!important;transform:none!important}
.pf-edit-action.edit{background:#E5E9FF!important;color:#5065D9!important}
.pf-edit-action.delete{background:#F8DEDA!important;color:#B85B54!important}
.pf-swipe-action{background:#E3F3EC!important;color:#3A806C!important}
.pf-add-box,.pf-add-fields,.pf-add-btn,.pf-edit-cancel{position:relative!important;z-index:3!important;pointer-events:auto!important}
`;}
install();new MutationObserver(()=>{if(!document.getElementById(ID))install()}).observe(document.documentElement,{childList:true,subtree:true});})();