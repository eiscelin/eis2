// A member whose first profile picture or video still waits for an admin can
// open the app and read it, but posting, commenting, reacting, uploading and
// messaging stay locked until the media is approved
window.ReadOnlyMode = (function () {
  function active() {
    return window.fbApprovalPending === true;
  }

  // Shows why the action is unavailable; true means the action must not run
  function block(what) {
    if (!active()) return false;
    showToast(`${what || 'This'} is locked until an admin approves your profile picture or video`, '', 5000);
    return true;
  }

  return { active, block };
})();
