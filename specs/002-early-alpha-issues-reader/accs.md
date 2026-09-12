- MAKE SURE THAT ONLY THE MOCK INSTANCES ARE BEING USED!
- Run Spec 001 accs.bash. If it fails, terminate it and self. If succeeds, terminate only the 001 script.
- Run the GitHub mock service. Ensure that there are Issues but all of them without any comments. 
- Ensure that 4 seconds have passed since the GitHub mock service spawn. Check again, the should be more entries than the last time, none of the ever repeating. Since the cli should be cleared on each update, no issue should appear twice.
- Make a new comment "Hello World!" under the first Issue using curl. 
- Check if the first issue logs that it has one comment.
- Run the Issues Tracker. 
- First issue form the GitHub terminal should have 2 comments, the rest should have 1, it is acceptable that of the later entries have 0.
- Other comments should say "I've been here!"
- Once again, check if there are any comments that would appear twice.

IF AT ANY POINT YOU NOTICE THAT AN ISSUES APPEARS TWICE, TERMINATE WITH AN ERROR!