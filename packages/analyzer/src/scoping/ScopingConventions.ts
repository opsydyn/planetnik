import { type Convention, createConvention } from "./Convention.js"

export class ScopingConventions {
  static testConventions(): Convention[] {
    return [
      createConvention(".*[/\\\\]test[s]?[/\\\\].*", "", "Test folder"),
      createConvention(".*[/\\\\]__test__[/\\\\].*", "", "Test folder"),
      createConvention(".*[/\\\\]__tests__[/\\\\].*", "", "Test folder"),
      createConvention(".*[/\\\\]spec[s]?[/\\\\].*", "", "Spec folder"),
      createConvention(".*[/\\\\]__spec__[/\\\\].*", "", "Spec folder"),
      createConvention(".*[._]test[.].*", "", "Test file"),
      createConvention(".*[._]spec[.].*", "", "Spec file"),
      createConvention(".*Test[.]java", "", "Java test file"),
      createConvention(".*Tests[.]java", "", "Java test file"),
      createConvention(".*Spec[.]java", "", "Java spec file"),
    ]
  }

  static generatedConventions(): Convention[] {
    return [
      createConvention(".*[/\\\\]generated[/\\\\].*", "", "Generated folder"),
      createConvention(".*[/\\\\]gen[/\\\\].*", "", "Generated folder"),
      createConvention(".*[.]generated[.].*", "", "Generated file"),
      createConvention(".*[.]g[.].*", "", "Generated file"),
      createConvention(".*[.]min[.].*", "", "Minified file"),
      createConvention(".*[.]bundle[.].*", "", "Bundle file"),
    ]
  }

  static buildAndDeploymentConventions(): Convention[] {
    return [
      createConvention(".*[/\\\\]build[/\\\\].*", "", "Build folder"),
      createConvention(".*[/\\\\]dist[/\\\\].*", "", "Dist folder"),
      createConvention(".*[/\\\\]out[/\\\\].*", "", "Output folder"),
      createConvention(".*[/\\\\]target[/\\\\].*", "", "Target folder"),
      createConvention(".*[/\\\\]node_modules[/\\\\].*", "", "Node modules"),
      createConvention(".*[/\\\\]\\.gradle[/\\\\].*", "", "Gradle folder"),
      createConvention(".*[/\\\\]\\.mvn[/\\\\].*", "", "Maven folder"),
      createConvention(".*Dockerfile.*", "", "Docker file"),
      createConvention(".*Makefile.*", "", "Makefile"),
      createConvention(".*Jenkinsfile.*", "", "Jenkins file"),
      createConvention(".*\\.ya?ml", "", "YAML config"),
    ]
  }

  static ignoreConventions(): Convention[] {
    return [
      createConvention(".*[/\\\\]\\.git[/\\\\].*", "", "Git folder"),
      createConvention(".*[/\\\\]\\.svn[/\\\\].*", "", "SVN folder"),
      createConvention(".*[/\\\\]\\.hg[/\\\\].*", "", "Mercurial folder"),
      createConvention(".*[/\\\\]\\.idea[/\\\\].*", "", "IntelliJ folder"),
      createConvention(".*[/\\\\]\\.vscode[/\\\\].*", "", "VS Code folder"),
    ]
  }
}
