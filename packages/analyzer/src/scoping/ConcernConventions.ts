import { type Convention, createConvention } from "./Convention.js"

export class ConcernConventions {
  exceptionHandling: Convention[] = [createConvention("", ".*catch.*", ""), createConvention("", ".*err( |\\t)*:=", "")]
  todos: Convention[] = [createConvention("", ".*(TODO|FIXME)( |:|\\t).*", "")]
  logging: Convention[] = [createConvention("", "(?i).*log[.].*", ""), createConvention("", "(?i).*logger[.].*", "")]
  printingToConsole: Convention[] = [createConvention("", ".*System.out.print.*", "")]
  configurationPoints: Convention[] = []
  databaseAccess: Convention[] = []
  fileOperations: Convention[] = []
  networkOperations: Convention[] = []
  synchronization: Convention[] = []
  authentication: Convention[] = []
  authorization: Convention[] = []
  sessionManagement: Convention[] = []
  encryption: Convention[] = []
  securedCommunication: Convention[] = []
  lowLevelMemoryOperations: Convention[] = []
  lowLevelStringManipulation: Convention[] = []
}
