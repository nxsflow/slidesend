# Brand assets of the site

The tokens (`src/brand/slidesend.css`) and the files in `public/brand/` are copies from
[nxsflow/brand](https://github.com/nxsflow/brand), not edited here. The copy of the page follows
the brand's copy deck, `copy/slidesend-landing.md`.

- Source: nxsflow/brand, commit `1087d4f` (PR #14, the logo kit "the wave").
- Update: `site/scripts/sync-brand.sh <path to the brand repo> <commit>`, then change the commit
  above and check the page against the copy deck.

Brand rules the page follows: the wordmark in the header, the symbol only as the favicon, never
both; the name always lowercase and never split (no highlighted, capitalised or hyphenated second
part, no "ss" as an abbreviation or prefix); spotlight as the one lit element per view (the install
command), and the accent `#CC3510` for text and controls, never spotlight itself on a light
background; every colour a token, which `src/brand.test.ts` checks. The favicons, the
apple-touch icon and the theme colour are linked as the brand's logo guide
(`logos/slidesend/README.md`) shows them.
