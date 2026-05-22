CadreOS lives or dies on role-aware visibility. The docs mention role-based access and relationship-aware visibility, but they do not define it deeply enough yet.

Example:

Action	Admin	Program Director	Coach	Parent	Athlete
Create team	Yes	Yes	No	No	No
View athlete notes	Yes	Yes	Team only	Own child only, limited	Own only, limited
Create attendance	Yes	Yes	Team only	No	No
RSVP to event	Yes	Yes	Yes	Own child	Self
Assign task	Yes	Yes	Team only	No	No

Without this, the app will become messy fast.
