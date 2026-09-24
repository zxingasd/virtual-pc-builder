# 虛擬電腦組裝 · 3D 裝機模擬

靜態網頁：開 `index.html` 或用 Vercel 部署即可。3D 用瀏覽器 WebGL（Three.js），唔需要安裝。

## 線上測試
- 正式：https://virtual-pc-builder.vercel.app
- 帳戶別名：https://virtual-pc-builder-zxingasd.vercel.app
- 程式碼：https://github.com/zxingasd/virtual-pc-builder

## 而家有咪
- 擡機箱、電源、主板、CPU、散熱、記憶體、SSD、顯示卡
- 硬性相容：插槽、DDR 世代、板型、顯卡長度、風冷高度、電源深度／瓦數
- 3D 裝機：自由順序或建議順序
- 毫米比例示意模型（標準／廠方公開尺寸）
- 曲線線材：24-pin、EPS、GPU 供電、前面板；背線／亂線兩種理線

## 唔會做既事
- 唔係廠商 CAD，亦唔係 Blender MCP
- 唔模擬螺絲扭力、針腳特寫、矽脂、逐條走線干涉
- 價格係美元約數，唔係香港即時報價
- 功耗 = CPU 官方 TDP + GPU 官方 TGP/TBP + 70W 固定開銷，唔係實測

## 本機
用瀏覽器直接開 `index.html`。

## Vercel
靜態網站，無需 build。連呢個 GitHub repo 之後每次 push 會自動部署。已關閉 Deployment Protection，公開可直接開。
