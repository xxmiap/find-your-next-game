Find Your Next Game — U.S. Edition
Xiao Xiao | CS-GY 6313 Information Visualization

Open dist/index.html in a current browser. It contains the complete catalog,
styles, JavaScript, and D3. No server or installation is required. External links
open only when clicked. The final HTML is also the file to host for the demo.

DATA CHANGE SINCE THE PROPOSAL
The proposal used a 2019 Steam snapshot; the prototype now uses a newer
snapshot with U.S. dollar prices so users can explore games using a familiar
budget. The three research questions and coordinated-view design carry over.

SOURCE AND PRICE BASIS
The dashboard is built from the Eskuel Steam Games 1.0.0 SQLite package
(released 2026-08-29), which repackages the 2026-08-25 snapshot of Fronkon
Games' Steam Games Dataset v44.
https://eskuel.de/en/databases/steam-games/
https://www.kaggle.com/datasets/fronkongames/steam-games-dataset/versions/44
Fronkon Games also publishes the upstream dataset on Hugging Face. Eskuel's
provenance records the mirror revision and input CSV checksum in
data/SOURCE_PROVENANCE.json.
https://huggingface.co/datasets/FronkonGames/steam-games-dataset
The package declares USD. The upstream collection code requests the U.S.
storefront by default and records the storefront final price, which can include
a discount. No exchange-rate conversion is applied.
https://github.com/FronkonGames/Steam-Games-Scraper/blob/main/SteamGamesScraper.py

125,854 unique games are loaded; 99,194 have positive recorded USD prices.
26,660 source zeros do not have a retained free flag, so they are displayed as
Unverified and excluded under a dollar cap. They remain searchable and eligible
under No cap when their other fields match. 42,501 records lack tags; title
search still includes them. 42,898 games have zero reviews and therefore no
review rate; only the scatterplot omits them. The source's publisher excluded
one nameless app upstream. This dashboard drops no rows from the pinned package.
Source notices, licensing, checksums and preparation details are in data/.

HOW TO DEMO
The online version is https://xxmiap.github.io/find-your-next-game/
Setup starts collapsed. Edit search reveals the full game and tag picker.
1. Reset to Risk of Rain (2013), Rogue-like + Indie + Platformer, macOS, $15.
2. Show 57 candidates. Click Make Platformer optional: 581 total, 524 newly included.
3. Click Highlight on the Rogue-like + Indie row. All three charts
   and the list reflect the same 524 highlighted records. The candidate set
   still contains 581 games. Hover a point for its USD price and reviews.
4. Use Points / Density to compare the same candidates. Hover a density cell
   for its totals; click to select those games in the other views and the list.
   Expand opens a larger chart, and the display mode is shared with the main view.
5. Clear selection to bring back the full list. Save a game to compare or
   export. Its CSV price_usd field holds dollars, not cents; it also includes
   price_status and the snapshot date.

VISUAL ENCODINGS AND IMPLEMENTATION
A: exact tag membership (fill) and game counts (common-scale bar length).
B: positive rate (linear vertical position), review count (log horizontal
position), newly included (hollow diamond), retained (filled circle), selection (blue
fill, white halo, and dark outline, preserving the original shape). Direct
labels identify up to three review-volume leaders in the active candidate
or selected set. Density mode groups points
into a fixed 20 × 10 grid; fill lightness encodes the number of games in each
cell and an outline marks cells that contain selected games. Hover reports the
cell totals, including newly included games, and selecting a cell preserves the candidate set.
D3 provides scales and brush.
C: ordered price bands in USD, horizontal bars for game counts and blue for
selected counts. Empty bands are omitted and the number omitted is displayed.
Unverified is separated from the ordered price bands.
Game details highlight current search-tag matches first, with a match count;
search tags not recorded for that game are listed separately.
The tag panel shows all recorded tags for the starting game. Suggested tags
are the first three in source order (the snapshot has no tag votes); they are
editable. Choose up to three tags to keep the exact-pattern matrix readable.
Reset restores the named classroom demo preset, not the source suggestions.
The chart guide contains an optional grayscale check for visual encodings.
The dashboard distinguishes catalog and recorded-price coverage from live
candidate and review-plot counts. The list labels the range on the current
page and whether its denominator is all candidates or only selected games.
The search screen, status, filters, Details, tables, and export share a central
USD model. Prices are stored as integer cents. Default ranked order is review
volume, and selecting by lowest price keeps unknown amounts at the end.

REBUILD AND VERIFY
python3 scripts/build.py              # Build offline HTML from catalog.json
node tests/core.test.cjs              # 56 independent SQL reference cases
node tests/browser.cjs                # Optional Playwright + headless Chrome
Browser paths can be set via PLAYWRIGHT_PATH and CHROME_PATH.
To regenerate the normalized catalog from the pinned SQLite archive, download
Eskuel's steam-games.eskueldb into data/raw/ and run:
python3 scripts/build.py --refresh
python3 tests/reference.py
The exact download link is in data/audit.json. The raw archive is retained in
the workspace and is not required to run or rebuild the bundled dashboard.

AI consultation/code drafting: Codex; earlier design consultation: Claude.
