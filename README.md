# Smart Local Vectorizer

Windows / Adobe Illustrator 2025 (实测 29.8.2，CEPHtmlEngine 12.1)。使用 CEP HTML 面板、ExtendScript 和独立 Python/OpenCV 子进程。在面板预览中进行鼠标交互。Adobe Illustrator 扩展入口见 https://developer.adobe.com/illustrator/ 。

## 安装与运行

解压整个目录，在含 install.ps1 的目录打开 PowerShell。安装 Python 3.9 或以上，并使 Illustrator 进程也能通过 PATH 调用 python。运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

安装程序会把扩展复制到当前用户的 Adobe/CEP/extensions/local.smartvector.panel，并为当前用户的 CSXS.12 启用未签名扩展调试。保存自己的文档后重启 Illustrator，打开「窗口 → 扩展 → Smart Local Vectorizer」。卸载时删除该扩展目录；如无其他调试扩展需要，移除 HKCU\Software\Adobe\CSXS.12 的 PlayerDebugMode 值。

1. 在 Illustrator 中选择「文件 → 脚本 → 其他脚本」运行 Example.jsx，它会创建示例文档并选中旋转后的 sample.png，点 Load selected bitmap。
面板顶部可切换中文 / EN，语言偏好会自动保存。以下步骤使用英文按钮名称。

2. 用 Select Region 在两个物体周围拖框，或用 Lasso 描边。用 Add、Subtract 组合矩形或套索。Object 模式优先使用透明度，照片使用 GrabCut，需要在框内留少量背景。Color 使用 RGB 单通道最大偏差。Smart Select 点击取色并查找连通区域，适合平面插画。Edge 输出闭运算后的边缘带轮廓。
3. 调整参数后约 250 ms 更新绿色候选预览。Smoothness 增大允许误差，Detail Level 减小允许误差。Preserve corners 将显著转角设为拟合分段点。Minimum Area 单位为预览像素面积。
4. Apply to Illustrator 创建独立图层。每个独立对象单独生成，带孔对象生成 CompoundPathItem。用直接选择工具选锚点或拖动控制柄。用 Illustrator 的撤销命令撤回生成，然后调整参数再次应用。直接重复应用会保留每次生成的图层。
5. Export SVG 导出预览坐标系内的路径。Illustrator 中用「文件 → 另存为」保存 AI。Example-artboard.svg 是由真实 Illustrator 导出的含底图示例。

## 实现与测试

engine.py 从标准输入读取裁剪后的 RGBA、选区掩模和参数，输出按对象、环、三次曲线排列的 JSON。每段包含起点、两个控制点和终点。panel.js 负责像素坐标、合成掩模、子进程取消、预览及 SVG。host.jsx 负责调取源图和写入文档。链接图按原图像素预览，并用对象中心和线性矩阵映射。嵌入图在临时文档中单独渲染，采用旋转后的轴对齐预览，按该预览的边界反算文档坐标。嵌入图预览分辨率取决于其在文档中的尺寸。

引擎用 OpenCV 轮廓层次保存孔洞，Douglas–Peucker 定位角点，以弦长参数最小二乘拟合三次曲线，在最大采样残差处递归拆段。误差限制针对输入轮廓采样点，不是连续曲线的双向 Hausdorff 距离保证。

```powershell
python -m pip install -r requirements.txt
python test_engine.py
python test_samples.py
```

第一项输出曲线 JSON 并检查闭合、锚点上限、圆环孔洞和三种模式。第二项验证 4096×2160 黑白图的局部裁剪、重复生成一致性、真实照片 GrabCut 和 Illustrator SVG 路径数。photo.jpg 来自 Matplotlib 的 Grace Hopper 示例照片。sample.png 同时覆盖透明图标、多色平面图和内部孔洞。

本机已通过以上两项测试和 JS 语法检查。通过真实 Illustrator COM 调用面板使用的同一 host.jsx，读取选中的链接图、旋转 24° 后应用两组路径、保存 AI 和导出 SVG。DOM 读回一个普通路径、一个含两条子路径的复合路径，其中一条子路径有 10 个锚点。另在临时文档成功读取旋转的嵌入图。尚未在重启后的 CEP 面板内人工验收鼠标交互、缩放、撤销和导出对话框。Smart Select 目前适合单次连通域选择；组合选区请使用矩形或套索。尚无批量队列。

