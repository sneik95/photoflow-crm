(()=>{'use strict';const ID='pf-swipe-pastel-fix-style';function install(){let s=document.getElementById(ID);if(!s){s=document.createElement('style');s.id=ID;document.head.appendChild(s)}s.textContent=`
/* PhotoFlow: swipe actions — fixed width, true centered labels, pastel palette */
.pf-edit-actions{width:220px!important;min-width:220px!important;max-width:220px!important;display:grid!important;grid-template-columns:110px 110px!important;align-items:stretch!important;overflow:hidden!important}
.pf-edit-action{width:110px!important;min-width:110px!important;max-width:110px!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;padding:0!important;margin:0!important;box-sizing:border-box!important;line-height:1!important;font-size:12px!important;font-weight:650!important;white-space:nowrap!important;overflow:hidden!important;text-indent:0!important;transform:none!important}
.pf-edit-action.edit{background:#E5E9FF!important;color:#5065D9!important}
.pf-edit-action.delete{background:#F8DEDA!important;color:#B85B54!important}
.pf-swipe-action{background:#E3F3EC!important;color:#3A806C!important}
`;}
install();new MutationObserver(()=>{if(!document.getElementById(ID))install()}).observe(document.documentElement,{childList:true,subtree:true});})();