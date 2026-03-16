import type { Palette } from "@planetnik/common"

export enum Alignment {
  LEFT = "LEFT",
  RIGHT = "RIGHT",
}

export class SimpleOneBarChart {
  backgroundColor = "#ffffff"
  activeColor = "#00aced"
  alignment: Alignment = Alignment.LEFT
  backgroundStyle = "fill-opacity:0.4;stroke:#a0a0a0;stroke-width:0.5px;"
  activeStyle = "fill:#c0deed;stroke:#898989;stroke-width:0.5;"
  width = 800
  maxBarWidth = 200
  barHeight = 20
  barStartXOffset = 300
  fontSize = "medium"

  calculateBarOffsetFromTexts(leftTexts: string[]): void {
    this.barStartXOffset = 0
    for (const text of leftTexts) {
      this.barStartXOffset = Math.max(this.barStartXOffset, 20 + text.length * 8)
    }
    this.barStartXOffset = Math.min(400, this.barStartXOffset)
    this.barStartXOffset = Math.max(100, this.barStartXOffset)
  }

  getStackedBarSvg(values: number[], palette: Palette, textLeft: string, textRight: string): string {
    let svg = `<svg width='${this.width}' height='${this.barHeight + 4}'>`

    const sum = values.reduce((a, b) => a + b, 0)

    svg += this.getBackgroundBarSvg(this.maxBarWidth)

    let x = this.barStartXOffset

    for (let i = 0; i < values.length; i++) {
      const value = values[i]!
      const color = palette.nextColor()
      if (value > 0.0000000001) {
        let barSize = Math.floor(this.maxBarWidth * (value / sum))
        if (barSize === 0) barSize = 1
        if (x < this.maxBarWidth + this.barStartXOffset) {
          if (i < values.length - 1 && x + barSize <= this.maxBarWidth + this.barStartXOffset) {
            svg += this.getColoredBarSvg(x, barSize, color)
          } else {
            svg += this.getColoredBarSvg(x, this.maxBarWidth + this.barStartXOffset - x, color)
          }
        }
        x += barSize
      }
    }

    svg += this.getRightAlignedTextSvg(textLeft, this.barStartXOffset - 4)
    svg += this.getTextSvg(textRight, this.barStartXOffset + 8 + this.maxBarWidth)
    svg += "</svg>"
    return svg
  }

  getLegend(labels: string[], palette: Palette): string {
    let html = "<div style='display: inline-block'>"
    for (const label of labels) {
      const color = palette.nextColor()
      html += `<div style='margin: 4px; vertical-align:middle;display:inline-block;width:14px;height:14px;background-color:${color}; border: 1px solid #a0a0a0;'></div>`
      html += `<div style='margin-right:10px; display:inline-block'>${label}</div>`
    }
    html += "</div>"
    return html
  }

  getPercentageSvg(percentage: number, textLeft: string, textRight: string): string {
    const activeBarSize = Math.max(1, (percentage * this.maxBarWidth) / 100.0)
    return this.getSvg(activeBarSize, textLeft, textRight)
  }

  getSvg(activeBarSize: number, textLeft: string, textRight: string): string {
    let svg = `<svg width='${this.width}' height='${this.barHeight + 4}'>`
    svg += this.getBackgroundBarSvg(this.maxBarWidth)
    svg += this.getBarSvg(Math.floor(activeBarSize))
    svg += this.getRightAlignedTextSvg(textLeft, this.barStartXOffset - 4)
    svg += this.getTextSvg(textRight, this.barStartXOffset + 8 + this.maxBarWidth)
    svg += "</svg>"
    return svg
  }

  setSmallerFontSize(): void {
    this.fontSize = "smaller"
  }

  private getRightAlignedTextSvg(text: string, x: number): string {
    return `<text text-anchor='end' font-size='${this.fontSize}' x='${x}' y='${Math.floor(this.barHeight / 2) + 7}'>${text}</text>`
  }

  private getTextSvg(text: string, x: number): string {
    return `<text font-size='${this.fontSize}' x='${x}' y='${Math.floor(this.barHeight / 2) + 7}'>${text}</text>`
  }

  private getBarSvg(activeBarSize: number): string {
    const x = this.barStartXOffset + (this.alignment === Alignment.LEFT ? 0 : this.maxBarWidth - activeBarSize)
    return `<rect x='${x}' y='2' width='${activeBarSize}' height='${this.barHeight}' style='${this.activeStyle}fill:${this.activeColor}'/>`
  }

  private getColoredBarSvg(x: number, width: number, color: string): string {
    return `<rect x='${x}' y='2' width='${width}' height='${this.barHeight}' style='${this.activeStyle}fill:${color}'/>`
  }

  private getBackgroundBarSvg(backgroundBarSize: number): string {
    return `<rect x='${this.barStartXOffset}' y='2' width='${Math.floor(backgroundBarSize)}' height='${this.barHeight}' style='${this.backgroundStyle}fill:${this.backgroundColor}'/>`
  }
}
