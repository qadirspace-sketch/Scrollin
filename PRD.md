# PRD: Posting Analytics Page

## Overview
Make the "Posting Analytics" page fully dynamic by implementing the missing interactive elements, connecting state handlers, and ensuring real data is filtered, sorted, and displayed correctly based on user selections.

## Task 1: Time Range Filter Implementation
Make the date range dropdown fully functional.
- Implement a styling-consistent dropdown menu for the time range button.
- Support options: "Last 7 Days", "Last 30 Days", "Last 90 Days", and "All Time".
- Ensure `setTimeRange` state updates when a user selects an option, triggering data recalculation for charts and metric cards.

## Task 2: Data Table Sorting
Implement dynamic column sorting for the "Recent Posts" table.
- Add interactive sort toggles (clickable table headers visually indicating sort direction) for columns: "Date", "Impressions", "Engagement".
- Implement state to track the active `sortColumn` and `sortDirection` (ascending/descending/none).
- Sort the displayed table data dynamically based on the active sort state.

## Task 3: Chart Visualization Types
Wire up interactivity for chart visualization toggle buttons.
- Connect the chart visualization type buttons (LineChart, BarChart, LayoutGrid) to a new state `chartType`.
- Render the `Performance Trend` chart as either an AreaChart or BarChart based on the user's selection.

## Task 4: Dynamic AI Insights
Ensure the AI Insights fully react to data range changes.
- Refine the generated insights to accurately reflect percentage changes between the selected current period and previous period.
- Show dynamic styling depending on positive vs. negative growth.
