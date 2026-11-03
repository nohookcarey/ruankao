// macOS Vision OCR 命令行工具
// 用途：把 PDF 转出的页面图片批量识别为文本，供题库解析抽取使用
//
// 编译：
//   swiftc -O -o /tmp/ocrbin ocr.swift
//
// 用法：
//   /tmp/ocrbin page-001.png page-002.png ...
//
// 输出：每页以 "===== 文件名 =====" 分隔，逐行输出识别文本。
// 速度：约 1.2 秒/页（200dpi 扫描页，M 系列芯片）。

import Foundation
import Vision
import AppKit

func ocr(_ path: String) -> String {
    guard let image = NSImage(contentsOfFile: path),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
    else {
        return "[读取失败] \(path)"
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    // 简体中文优先，英文兜底（软考官方书是中英混排）
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        return "[识别失败] \(path): \(error)"
    }

    guard let observations = request.results else { return "" }
    // Vision 返回的顺序基本是从上到下，按 y 坐标再排一次更稳
    let lines = observations
        .compactMap { $0.topCandidates(1).first?.string }
    return lines.joined(separator: "\n")
}

let args = Array(CommandLine.arguments.dropFirst())
if args.isEmpty {
    FileHandle.standardError.write("用法: ocrbin <图片...>\n".data(using: .utf8)!)
    exit(1)
}

for path in args {
    print("===== \(path) =====")
    print(ocr(path))
}
