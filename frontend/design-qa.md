# Carrier iPhone Frame Design QA

- Source visual truth: `/var/folders/86/_7bj3qzj7gd6nr94ctr5h2g40000gn/T/TemporaryItems/NSIRD_screencaptureui_RNc0lp/스크린샷 2026-08-12 16.14.37.png`
- Final implementation capture: `/tmp/movin-carrier-clean-mobile-final.png`
- Responsive capture: `/tmp/movin-carrier-clean-390-final.png`
- Desktop capture: `/tmp/movin-carrier-clean-desktop-final.png`
- Comparison viewport: 512 x 1030 CSS px at density 1
- Source pixels: 512 x 1030
- Implementation pixels: 512 x 1030
- Density normalization: none required; source and implementation were compared at equal pixel dimensions
- State: carrier base-profile screen, before pressing `확인했어요`

## Full-view comparison evidence

The source and final implementation were opened together at 512 x 1030. The implementation now follows the source device treatment: a thin silver outer rim, narrow black bezel, continuous edge-to-edge screen surface, overlaid time/status indicators and Dynamic Island, large rounded corners, and an overlaid home indicator. The previous separate black top and bottom blocks and nested rounded 16:9 panel are gone.

The source home-screen wallpaper and app icons were intentionally not reproduced because the implementation must continue to show the interactive Mov!n carrier workflow. The external role-return control is also retained outside the phone because it is an explicit product requirement from the preceding change.

## Focused-region evidence

A separate crop was not required because the equal-size 512 x 1030 comparison keeps the complete bezel, status bar, Dynamic Island, app typography, cards, CTA, and home indicator readable. A 390 x 844 responsive capture was additionally inspected for the top status region; the Dynamic Island has 16 px clearance from the status indicators with no overlap.

## Required fidelity surfaces

- Fonts and typography: Mov!n keeps the product's existing heading and Korean UI typography. The status bar uses an iOS-like system stack and matches the source hierarchy without colliding with the island.
- Spacing and layout rhythm: app content starts below the status area; the screen surface is continuous to the bottom safe area. Card rhythm and CTA spacing remain intact.
- Colors and visual tokens: the hardware rim uses neutral silver/black from the source. The white app surface and yellow Mov!n accent intentionally replace the source wallpaper palette.
- Image quality and asset fidelity: iOS status indicators and the home indicator use reusable vector assets. No rasterized screenshot or fake app-content imagery is used.
- Copy and content: all carrier labels and actions remain unchanged and readable.

## Comparison history

1. Initial capture: `/tmp/movin-carrier-clean-mobile-v1.png`
   - P1: the compact breakpoint pulled the Mov!n logo into the Dynamic Island.
   - P2: the device under-filled the reference-sized viewport and left excessive canvas space.
   - Fixes: reserved the full iOS top safe area, increased the device corner radii, and enlarged the mobile device while keeping the return control outside.
2. Second capture: `/tmp/movin-carrier-clean-mobile-v2.png`
   - P2: the device still appeared smaller than the source composition.
   - Fix: reduced the space reserved for the outside return control and expanded the device to the available viewport.
3. Compact responsive check: `/tmp/movin-carrier-clean-390-final.png`
   - P1: status indicators touched the Dynamic Island at 390 px.
   - Fix: made the island and status asset widths responsive; final measured clearance is 16 px.
4. Final capture: `/tmp/movin-carrier-clean-mobile-final.png`
   - Post-fix evidence: no P0/P1/P2 differences remain for the requested device-frame treatment.

## Interaction and runtime checks

- Page identity: `http://127.0.0.1:5174/`, title `Mov!n — AI 배차 코파일럿`
- Primary interaction: `확인했어요` opens `선호 조건 설정`
- Return interaction: the outside switch returns to the shipper screen
- Responsive behavior: 390 x 844 phone and return control remain inside the viewport; preference content scrolls
- Framework overlay: none
- Console errors/warnings: none

## Remaining P3 / intentional differences

- The reference wallpaper, home-screen widgets, and app icons are not part of the Mov!n carrier UI and are intentionally omitted.
- The status glyphs are black instead of white to maintain contrast on the white Mov!n surface.
- The outside role-return control remains visible by prior product requirement.

final result: passed
