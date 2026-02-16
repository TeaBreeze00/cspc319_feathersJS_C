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
```

---

## 4. FAQ - New Question

**Current:**
```
!!! Q: What does a feedback form look like?
Review the HCI Principles lectures; limit your questions to ensure the feedback you receive is actionable
```

**Replace with:**
```
Q: What should I include in a feedback form?
A: Keep it short (5-7 questions max) and actionable. Focus on usability, not opinions.

Good questions (based on HCI principles):
✅ "Were you able to complete the task without help?" (Yes/No + explain)
✅ "What was most confusing about this feature?"
✅ "Rate ease of use: 1 (very difficult) to 5 (very easy)"
✅ "Did error messages help you understand what went wrong?"
✅ "What would you change about this interface?"

Avoid vague questions:
❌ "Do you like the design?" (Too subjective)
❌ "Is this intuitive?" (They don't know what you meant to do)
❌ "Would you use this app?" (Not actionable)

Pro tip: Review your HCI Principles lectures for more guidance on effective user testing questions.
```

---

## 5. FAQ - Example Context Question

**Current:**
```
Q: How many tasks should we prepare?
A: 3-5 tasks, completable in 12-15 minutes total.
Ex. !!! Setting the context of the application, remembering other students aren't aware
```

**Replace with:**
```
Q: How many tasks should we prepare?
A: 3-5 tasks, completable in 12-15 minutes total.

Example setup: "You're a volunteer coordinator trying to register for an upcoming event. Your goal is to find events happening this month, register for one, and confirm your registration was successful."

Remember: Other students don't know your project! Provide context:
- Who is the user? (admin, volunteer, donor, etc.)
- What are they trying to accomplish?
- What's the starting point? (already logged in? what page?)
- What does success look like?