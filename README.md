# Our Orbit

一个使用浏览器端加密的私人纪念网页。发布目录只包含密文，可以托管在 GitHub Pages。

## 本地更新

1. 修改 `.private/content.json` 中的故事、地点和项目。
2. 第一次运行 `node scripts/build-private.mjs` 会在 `.private/password.txt` 创建随机密码。
3. 如需自定义密码，修改 `.private/password.txt`，密码至少 12 个字符，建议 16 个以上。
4. 再次运行 `node scripts/build-private.mjs`，生成新的 `dist/content.enc.json`。

`.private` 文件夹不会进入 Git；不要把其中的内容、密码或私人照片提交到公开仓库。

## GitHub Pages

推送到 `main` 分支后，在仓库的 **Settings → Pages → Source** 中选择 **GitHub Actions**。工作流只发布 `dist` 文件夹。
