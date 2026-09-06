package planetnik.capture;

import nl.obren.sokrates.common.io.JsonGenerator;
import nl.obren.sokrates.common.utils.ProgressFeedback;
import nl.obren.sokrates.sourcecode.SourceFile;
import nl.obren.sokrates.sourcecode.dependencies.DependenciesAnalysis;
import nl.obren.sokrates.sourcecode.lang.rust.RustAnalyzer;
import nl.obren.sokrates.sourcecode.units.UnitInfo;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Small, source-independent probe used by Planetnik's pinned Sokrates capture
 * lane. It deliberately calls the upstream analyzer directly instead of
 * scraping a report or copying JUnit expectations.
 */
public final class SokratesRustCapture {
    private SokratesRustCapture() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException("usage: SokratesRustCapture <source-file> <output-json>");
        }

        Path sourcePath = Path.of(args[0]);
        Path outputPath = Path.of(args[1]);
        String content = Files.readString(sourcePath);

        SourceFile sourceFile = new SourceFile(new File(sourcePath.toString()), content);
        RustAnalyzer analyzer = new RustAnalyzer();
        List<UnitInfo> units = analyzer.extractUnits(sourceFile);
        DependenciesAnalysis dependencies = analyzer.extractDependencies(
                List.of(sourceFile), new ProgressFeedback());

        List<Map<String, Object>> unitExports = new ArrayList<>();
        for (UnitInfo unit : units) {
            Map<String, Object> export = new LinkedHashMap<>();
            export.put("shortName", unit.getShortName());
            export.put("startLine", unit.getStartLine());
            export.put("endLine", unit.getEndLine());
            export.put("linesOfCode", unit.getLinesOfCode());
            export.put("mcCabeIndex", unit.getMcCabeIndex());
            export.put("numberOfParameters", unit.getNumberOfParameters());
            export.put("numberOfLiterals", unit.getNumberOfLiterals());
            export.put("numberOfStatements", unit.getNumberOfStatements());
            export.put("numberOfExpressions", unit.getNumberOfExpressions());
            unitExports.add(export);
        }

        List<String> dependencyPaths = dependencies.getDependencies().stream()
                .filter(dependency -> dependency.getTo() != null)
                .map(dependency -> dependency.getTo().getAnchor())
                .sorted(Comparator.nullsLast(String::compareTo))
                .collect(Collectors.toList());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("units", unitExports);
        payload.put("dependencyPaths", dependencyPaths);

        if (outputPath.getParent() != null) {
            Files.createDirectories(outputPath.getParent());
        }
        new JsonGenerator().generateToFile(payload, outputPath.toFile());
    }
}
