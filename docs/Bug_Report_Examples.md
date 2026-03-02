# Bug Report Examples

## Example 1: Critical Bug

**Discovered By:** Alice Chen  
**Date:** February 17, 2025  
**Session:** Session A

---

### Steps to Reproduce
1. Log in as volunteer user
2. Navigate to "My Events" page
3. Click "Register" button on any event
4. Fill out registration form
5. Click "Submit"

### Expected Behavior
Registration should be saved and confirmation message displayed

### Actual Behavior
Page shows "500 Internal Server Error" and registration is not saved

### Severity
- [x] 🔴 Critical - App crashes, data loss, or can't complete core functionality

### Screenshots/Additional Context
Error in console: "Cannot read property 'id' of undefined"

---

## Example 2: Major Bug

**Discovered By:** Bob Kumar  
**Date:** February 17, 2025  
**Session:** Session B

---

### Steps to Reproduce
1. Log in as admin
2. Go to "Reports" section
3. Select date range: Jan 1 - Feb 1
4. Click "Generate Report"

### Expected Behavior
Report displays data for selected date range

### Actual Behavior
Report always shows past 7 days, ignores date selection

### Severity
- [x] 🟡 Major - Feature doesn't work as intended, but workaround exists

### Screenshots/Additional Context
Workaround: Manually filter exported CSV
Date picker accepts input but doesn't filter results

---

## Example 3: Minor Bug

**Discovered By:** Carol Lee  
**Date:** February 17, 2025  
**Session:** Session C

---

### Steps to Reproduce
1. Open app on mobile device
2. Navigate to profile page
3. Observe button placement

### Expected Behavior
"Edit Profile" button properly aligned and accessible

### Actual Behavior
Button partially cut off at screen edge on mobile

### Severity
- [x] 🟢 Minor - Cosmetic issue, confusing UI, or small inconvenience

### Screenshots/Additional Context
Tested on iPhone 13, Safari
Desktop works fine, button still clickable