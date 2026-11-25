# Find Your Next Game

CS-GY 6313 Information Visualization dashboard, revised after professor feedback. Explore Steam games by shared tags, review evidence, and price in U.S. dollars.

## Open the dashboard

[Launch Find Your Next Game](https://xxmiap.github.io/find-your-next-game/)

The hosted version uses the same bundled catalog as the offline version.

## Run the prototype

1. From this repository, select **Code → Download ZIP**, then extract the ZIP.
2. Open `dist/index.html` in a browser. The catalog and dependencies are bundled in the HTML, so it opens offline without installation.

## Try the demo

Select **Reset**, then click **Make Platformer optional** to expand the default Risk of Rain search from 57 to 581 candidates. In **Shared tags**, click **Highlight** on the **Rogue-like + Indie** row to focus on its 524 games across the charts and results list. The checkboxes add or remove tag combinations from the search.

The search starts collapsed with the selected game, tags, budget and platform visible. Choose **Edit search** to change them. Selecting a game collapses setup automatically. Games without recorded tags keep setup open for manual tag selection.

Retained games use filled circles and newly included games use hollow diamonds. A selected game keeps its shape and gains a stronger blue fill and contrasting ring. The most-reviewed candidates receive direct labels. Empty price bands are hidden.

## Feedback and demonstration

[Professor feedback and changes](Professor_Feedback_Changes.txt) records the revisions and their tradeoffs. [Scripted walkthrough](Final_Walkthrough_EN.txt) follows one search with Chinese operation cues for recording.

See [README.txt](README.txt) for the data sources, visual encodings, and optional rebuild instructions.
