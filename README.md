# CAP37-matchup-evaluator

A tool used to check how matchups against CAP37 will turn out, but can be expanded to general mons. The idea is to know how our interactions change based on changes in stats, moves, and investment. 

Factors considered are Taunt and Knock Off interactions, damage thresholds, recovery outlasting our damage, how Beak Blast can punish contact moves, if status fishing is possible, how we can't switch into status moves, etc as detailed in Spammernoob's post https://www.smogon.com/forums/threads/cap-37-part-6-threats-discussion.3779229/post-10918928

Runs on showdown calculator. At the moment, it does not support customising the mon, so you have to put in a species name to get its stats (Mandibuzz, Yveltal, Honchkrow are the ones I've tried to verify the logic.

Some interactions, such as against Garganacl's Salt Cure, are also not represented, as well as more nuanced takes like PP stalling.
