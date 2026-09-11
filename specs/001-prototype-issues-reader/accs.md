- Run the GitHub mock service first, then the Issues Tracker.
- Just to be sure, verify if GitHub mock service API returns any issues. Quick curl should be enough.
- Check the issues tracker console. You should see the same entries as in the curl result, possible in different format.
- Assure that 4 seconds have passed since initial GitHub curl, make another fetch - there should be more entries than the last time this time.
- Issues Tracker console should not be prompted to fetch, it should be doing it proactively. Thus - once again, there should be more entries in the console at this point than before.
- All throughout, there should always be a status bar at the bottom of the console. There should be a simple Polling indicator.

Example (low fidelity):

{ issue_id: 1 }
{ issue_id: 2 }
{ issue_id: 3 }
Polling.   (1s)

{ issue_id: 1 }
{ issue_id: 2 }
{ issue_id: 3 }
{ issue_id: 4 }
Polling..  (2s)

{ issue_id: 1 }
{ issue_id: 2 }
{ issue_id: 3 }
{ issue_id: 4 }
{ issue_id: 5 }
Polling... (3s)

{ issue_id: 1 }
{ issue_id: 2 }
{ issue_id: 3 }
{ issue_id: 4 }
{ issue_id: 5 }
{ issue_id: 6 }
Polling.   (4s)
