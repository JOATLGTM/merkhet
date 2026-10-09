# Proposed updates for approval

**Prepared for:** Merkhet
**Prepared by:** Chris Vo
**Date:** October 8, 2026

This document lists the changes proposed for the Merkhet project board. Each item has a short description, what it means for your team, and a line for your decision. Mark **Approve** or **Decline** on each one, add any notes, and return the document. Nothing on this list has been built yet. Items that need information from you are marked.

Items are grouped into four sections:

1. Items that need information from you before work can start.
2. Visible changes to the app for your approval.
3. Behind-the-scenes changes that need your awareness, not a design decision.
4. Features set aside earlier, listed so you can opt in or confirm they stay out.

## 1. Needs information from you

### 1.1 Client email footer

**Today:** Every email the system sends to your clients ends with a placeholder footer: a sample street address, a 555 phone number, and a reply-to address on a domain Merkhet does not own. Client emails have been sending since September 27, 2026, so clients are seeing these placeholders now.

**Proposed:** Remove the street address and phone number from the footer entirely. The footer keeps the firm name and a real email address for replies.

**What we need from you:**

| Value | Your answer |
| --- | --- |
| Email address that receives client replies | |

**Related question:** Today, if a client replies to a system email, the reply goes to a no-reply address and is lost. Do you want replies routed to the address above?

| Decision | |
| --- | --- |
| Remove address and phone from the footer | ☐ Approve ☐ Decline |
| Route client replies to the address above | ☐ Yes ☐ No |

## 2. Visible changes for your approval

### 2.1 Late and due-soon markers on the board and calendar

**Today:** A project card shows the client's target completion date in red when it has passed and in amber when it is within two weeks. Nothing shows whether the current phase itself is late.

**Proposed:** Each card on the board gets a small label based on the current phase's planned end date:

- "Phase late 2d" in red when the phase end date has passed.
- "Phase due today" or "Phase due in 3d" in amber within three days of the end date.
- No label when the phase is more than three days out, has no planned dates, or the project is on hold.

On the calendar, the bar for a late phase gets a red outline. Nothing else on the calendar changes.

**Question for you:** The Review and Final Review steps are single-day milestones rather than multi-day phases. Should they show these markers too, or stay unmarked?

| Decision | |
| --- | --- |
| Late and due-soon markers | ☐ Approve ☐ Decline |
| Show markers on Review and Final Review milestones | ☐ Yes ☐ No |

### 2.2 Keyboard moves and a "Move to…" menu on cards

**Today:** The only way to move a project to a new stage is to drag it with a mouse. There is no way to move a card from the keyboard, and screen readers get no announcement.

**Proposed:** Each card gets a small "…" menu in the top corner with a "Move to…" list of stages. Cards can also be picked up and moved with the keyboard. The same rules apply as a drag, including the requirement to upload a contract before leaving Pending.

| Decision | |
| --- | --- |
| Keyboard moves and Move to… menu | ☐ Approve ☐ Decline |

### 2.3 Clearer feedback during actions in the project panel

**Today:** When you upload a contract, record a sign-off, or put a project on hold, the button gives no sign that anything is happening. In one case the app shows a green success message even when the save failed.

**Proposed:**

- The clicked button disables and reads "Uploading…", "Recording…", "Saving…" and so on until the action finishes. This also prevents accidental double uploads.
- The success message shows only when the save succeeded.
- The hold reason is entered in a small in-app popover next to the button instead of a browser pop-up window.
- Clearing a recorded sign-off asks "Clear this sign-off?" before removing it.
- The Customers table shows a "No customers" row when a search matches nothing, instead of going blank.

| Decision | |
| --- | --- |
| Action feedback and confirmations | ☐ Approve ☐ Decline |

### 2.4 Error screen with a "Try again" button

**Today:** If the database is briefly unreachable, the page fails without explanation.

**Proposed:** The page shows "Couldn't load this page" with a one-line explanation and a "Try again" button. The sidebar stays in place.

| Decision | |
| --- | --- |
| Error screen | ☐ Approve ☐ Decline |

## 3. Behind-the-scenes changes

These change how the app works internally, not how it looks. Your approval is for the approach and the testing steps that touch your live account.

### 3.1 Faster board moves

**Today:** When you drag a card to a new stage, the app sends the notification emails before it responds to you. Each move waits on several database round trips and one or more email sends, so a drag can feel slow to land.

**Proposed, in three separate releases:**

1. **Fewer database trips per move.** The card lands faster. No change to emails.
2. **Emails send after the screen updates.** The notification is still recorded at the moment of the move, but the actual send happens right after instead of making you wait. An automatic retry runs every five minutes, so an email that fails to send the first time is sent again without anyone noticing. Today a failed email has to be re-sent by hand.
3. **Lighter page loads.** The board stops loading completed projects and full history it does not display. Project history loads when you open a project panel.

**Who receives what does not change.** Every email goes to the same people with the same wording as today. Each release is checked against a local copy of the database before it goes live, so no client receives a test email.

| Decision | |
| --- | --- |
| Faster board moves, three releases | ☐ Approve ☐ Decline |

### 3.2 A test customer and project on the live site

To measure the speed improvement, we need to time real card moves on the live site. Moving a real project into a client-visible stage emails the real client, so the timing runs on a throwaway project instead.

**Proposed:** Create one test customer whose contact email is our own address, and one test project under it. Drag that project between stages a few times, then delete both. Staff assigned to the phases and the admins still receive the internal emails for those moves, so we will tell your team the day before.

| Decision | |
| --- | --- |
| Test customer and project on the live site | ☐ Approve ☐ Decline |

### 3.3 Two email behaviors to confirm

These came up during the review. Both are how the system works today. Tell us whether to keep or change each.

**Backward moves email the client.** Dragging a project from Design Development back to Schematic Design sends the client a "Schematic design has begun" email. A forward-only rule would send client emails only when a project advances.

| Decision | |
| --- | --- |
| Send client emails only on forward moves | ☐ Change to forward-only ☐ Keep as is |

**Unassigned design phases email nobody internally.** When a project enters Schematic Design, Design Development, or Construction Documents and no one is assigned to that phase, no internal email goes out. The client still gets theirs. One option is to email the admins with a note that no one is assigned.

| Decision | |
| --- | --- |
| Email admins when a phase starts unassigned | ☐ Change ☐ Keep as is |

## 4. Features set aside earlier

These were considered in September and not scheduled. They are listed so you can opt in to any of them. Each is a moderate piece of work. Mark **Yes** to add one to the plan.

| Feature | What it does | Add it? |
| --- | --- | --- |
| **My work page** | A personal list for each staff member of the phases assigned to them, sorted by due date, with late items first. | ☐ Yes ☐ No |
| **Monday digest email** | Every Monday, each person gets one email listing their late and due-this-week phases. | ☐ Yes ☐ No |
| **Project notes with @mentions** | A notes section on each project. Mentioning a colleague emails them. | ☐ Yes ☐ No |
| **Client email record** | Each customer page lists the emails the system sent to that client, with dates. Optionally, a copy of every client email goes to a studio mailbox. | ☐ Yes ☐ No |
| **Reorder the project panel** | Move the Phases section nearer the top of the project panel and add jump links. | ☐ Yes ☐ No |
| **Per-page browser tab titles** | Each page gets its own browser tab title, such as "Calendar · Merkhet", instead of the same title everywhere. | ☐ Yes ☐ No |

## Suggested order of work

If everything is approved, the work lands in this order:

1. Client email footer (section 1.1), as soon as the reply address arrives.
2. Action feedback, error screen, and the success-message fix (2.3, 2.4).
3. Faster board moves, release 1 (3.1).
4. Late and due-soon markers (2.1).
5. Faster board moves, releases 2 and 3 (3.1), each watched for a day after going live.
6. Keyboard moves and the Move to… menu (2.2).

## Sign-off

| | |
| --- | --- |
| Name | |
| Date | |
| Notes | |
