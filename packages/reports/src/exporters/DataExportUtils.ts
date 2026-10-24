export class DataExportUtils {
  static getComponentFileName(prefix: string, componentName: string): string {
    return `${prefix}${componentName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  }

  static getAspectFileName(prefix: string, aspectName: string): string {
    return `${prefix}${aspectName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  }
}
