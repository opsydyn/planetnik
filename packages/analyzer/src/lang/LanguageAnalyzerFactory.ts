import { CSharpAnalyzer } from "./CSharpAnalyzer.js"
import { CStyleAnalyzer } from "./CStyleAnalyzer.js"
import { CssAnalyzer } from "./CssAnalyzer.js"
import { DefaultLanguageAnalyzer } from "./DefaultLanguageAnalyzer.js"
import { GoLangAnalyzer } from "./GoLangAnalyzer.js"
import { HaskellAnalyzer } from "./HaskellAnalyzer.js"
import { HtmlAnalyzer } from "./HtmlAnalyzer.js"
import { JavaAnalyzer } from "./JavaAnalyzer.js"
import { JavaScriptAnalyzer } from "./JavaScriptAnalyzer.js"
import { JsonAnalyzer } from "./JsonAnalyzer.js"
import { KotlinAnalyzer } from "./KotlinAnalyzer.js"
import type { LanguageAnalyzer } from "./LanguageAnalyzer.js"
import { PythonAnalyzer } from "./PythonAnalyzer.js"
import { RubyAnalyzer } from "./RubyAnalyzer.js"
import { RustAnalyzer } from "./RustAnalyzer.js"
import { ShellAnalyzer } from "./ShellAnalyzer.js"
import { SqlAnalyzer } from "./SqlAnalyzer.js"
import { TypeScriptAnalyzer } from "./TypeScriptAnalyzer.js"
import { XmlAnalyzer } from "./XmlAnalyzer.js"
import { YamlAnalyzer } from "./YamlAnalyzer.js"

type AnalyzerConstructor = new () => LanguageAnalyzer

const analyzersMap = new Map<string, AnalyzerConstructor>()

function registerExtensions(extensions: readonly string[], analyzer: AnalyzerConstructor) {
  for (const extension of extensions) {
    analyzersMap.set(extension, analyzer)
  }
}

registerExtensions(["java", "ck", "j", "uc"], JavaAnalyzer)

registerExtensions(
  [
    "js",
    "cy",
    "_js",
    "bones",
    "cjs",
    "es",
    "es6",
    "gs",
    "jake",
    "jsb",
    "jscad",
    "jsfl",
    "jsm",
    "mjs",
    "njs",
    "pac",
    "sjs",
    "ssjs",
    "xsjs",
    "xsjslib",
  ],
  JavaScriptAnalyzer,
)

registerExtensions(["ts", "tsx"], TypeScriptAnalyzer)
registerExtensions(["go", "v"], GoLangAnalyzer)
registerExtensions(["hs", "lhs", "hsc", "hsig", "chs"], HaskellAnalyzer)
registerExtensions(["cs", "cake", "csx"], CSharpAnalyzer)

registerExtensions(
  [
    "c",
    "cats",
    "cpp",
    "cc",
    "cp",
    "cxx",
    "h",
    "hh",
    "hpp",
    "hxx",
    "inl",
    "ino",
    "ipp",
    "tcc",
    "tpp",
    "m",
    "mm",
    "dart",
  ],
  CStyleAnalyzer,
)

registerExtensions(
  [
    "py",
    "gyp",
    "gypi",
    "lmi",
    "py3",
    "pyde",
    "pyi",
    "pyp",
    "pyt",
    "pyw",
    "rpy",
    "smk",
    "tac",
    "wsgi",
    "xpy",
    "eb",
    "gn",
    "pyx",
    "pxd",
    "pxi",
    "numpy",
    "numpyw",
    "numsc",
    "pytb",
  ],
  PythonAnalyzer,
)

registerExtensions(["kt", "ktm", "kts"], KotlinAnalyzer)
registerExtensions(["rs", "rlib"], RustAnalyzer)

registerExtensions(
  [
    "rb",
    "builder",
    "eye",
    "gemspec",
    "god",
    "jbuilder",
    "mspec",
    "podspec",
    "rabl",
    "rake",
    "rbi",
    "rbuild",
    "rbw",
    "rbx",
    "ru",
    "ruby",
    "thor",
    "watchr",
  ],
  RubyAnalyzer,
)

registerExtensions(
  [
    "html",
    "htm",
    "cshtml",
    "vbhtml",
    "razor",
    "soy",
    "st",
    "xht",
    "xhtml",
    "jinja",
    "jinja2",
    "mustache",
    "njk",
    "ecr",
    "eex",
    "erb",
    "deface",
    "haml",
    "mtml",
    "rtml",
    "vue",
    "phtml",
    "hhi",
    "hbs",
    "handlebars",
    "asp",
    "aspx",
    "asax",
    "ascx",
    "ashx",
    "asmx",
    "axd",
    "jsx",
  ],
  HtmlAnalyzer,
)

registerExtensions(
  [
    "xml",
    "xaml",
    "owl",
    "adml",
    "admx",
    "ant",
    "axml",
    "builds",
    "ccproj",
    "ccxml",
    "clixml",
    "cscfg",
    "csdef",
    "csl",
    "csproj",
    "ct",
    "depproj",
    "dita",
    "ditamap",
    "ditaval",
    "dotsettings",
    "filters",
    "fsproj",
    "fxml",
    "glade",
    "gmx",
    "grxml",
    "iml",
    "ivy",
    "jelly",
    "jsproj",
    "kml",
    "launch",
    "mdpolicy",
    "mjml",
    "mxml",
    "natvis",
    "ndproj",
    "nproj",
    "nuspec",
    "odd",
    "osm",
    "pkgproj",
    "pluginspec",
    "proj",
    "props",
    "ps1xml",
    "psc1",
    "pt",
    "rdf",
    "resx",
    "rss",
    "scxml",
    "sfproj",
    "shproj",
    "srdf",
    "storyboard",
    "targets",
    "tml",
    "ui",
    "urdf",
    "ux",
    "vbproj",
    "vcxproj",
    "vsixmanifest",
    "vssettings",
    "vstemplate",
    "vxml",
    "wixproj",
    "workflow",
    "wsdl",
    "wsf",
    "wxi",
    "wxl",
    "wxs",
    "x3d",
    "xacro",
    "xib",
    "xlf",
    "xliff",
    "xmi",
    "xproj",
    "xsd",
    "xspec",
    "xul",
    "zcml",
    "plist",
    "xpl",
    "xproc",
    "xquery",
    "xq",
    "xql",
    "xqm",
    "xqy",
    "xsl",
    "xslt",
  ],
  XmlAnalyzer,
)

registerExtensions(["css"], CssAnalyzer)

registerExtensions(
  [
    "json",
    "json5",
    "jsonld",
    "avsc",
    "geojson",
    "gltf",
    "har",
    "jsonl",
    "mcmeta",
    "tfstate",
    "topojson",
    "webapp",
    "webmanifest",
    "yy",
    "yyp",
    "jsonc",
  ],
  JsonAnalyzer,
)

registerExtensions(["tf", "yml", "yaml", "mir", "reek", "rviz", "syntax", "sublime-syntax"], YamlAnalyzer)
registerExtensions(["sh", "bash", "bats", "command", "ksh", "tmux", "tool", "zsh"], ShellAnalyzer)
registerExtensions(
  ["bdy", "fnc", "prc", "spc", "tpb", "tps", "trg", "vw", "sql", "cql", "ddl", "mysql", "tab", "udf", "viw"],
  SqlAnalyzer,
)

export class LanguageAnalyzerFactory {
  private static instance = new LanguageAnalyzerFactory()

  static getInstance(): LanguageAnalyzerFactory {
    return LanguageAnalyzerFactory.instance
  }

  getLanguageAnalyzerByExtension(extension: string): LanguageAnalyzer {
    const Ctor = analyzersMap.get(extension.toLowerCase())
    if (Ctor) return new Ctor()
    return new DefaultLanguageAnalyzer()
  }

  getLanguageAnalyzer(extension: string): LanguageAnalyzer {
    return this.getLanguageAnalyzerByExtension(extension)
  }

  getRegisteredExtensions(): string[] {
    return Array.from(analyzersMap.keys())
  }
}
