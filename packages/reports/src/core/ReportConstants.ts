export const REPORTS_HTML_HEADER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{TITLE}}</title>
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css">
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/js/bootstrap.min.js"></script>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; }
h1 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
h2 { color: #555; margin-top: 30px; }
table { margin: 10px 0; }
.section { margin-bottom: 30px; }
.breadcrumbs { font-size: 0.9em; color: #888; margin-bottom: 10px; }
.breadcrumbs a { color: #337ab7; text-decoration: none; }
pre.graphviz { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
</style>
{{CUSTOM_HEADER}}
</head>
<body>
<div class="container-fluid">
`

export const REPORTS_HTML_FOOTER = `
</div>
</body>
</html>`
