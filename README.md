# Our Orbit

一个使用浏览器端加密的私人纪念网页。发布目录只包含密文，可以托管在 GitHub Pages。

## 本地更新

1. 修改 `.private/content.json` 中的故事、地点和项目，或 `.private/projects/` 中的 `love.html`、`letters.html`。
2. 第一次运行 `node scripts/build-private.mjs` 会在 `.private/password.txt` 创建随机密码。
3. 如需自定义密码，修改 `.private/password.txt`。密码可以是任意非空字符；为了安全，仍建议使用较长密码。
4. 再次运行 `node scripts/build-private.mjs`，重新生成 `dist` 中的主页和项目密文。
5. 提交前运行 `node scripts/verify-build.mjs`，确认密文能用当前密码解开，且公开文件中没有私人明文。修改 `love.html` 后再运行 `node scripts/verify-love-layout.mjs`。

修改 `.private/password.txt` 后必须重新构建并发布，否则网站仍使用旧密码。

`.private` 文件夹不会进入 Git；不要把其中的内容、密码或私人照片提交到公开仓库。`scripts` 和 README 也在公开仓库里，与具体内容相关的检查项请写在 `.private/verify-expectations.json`。

## GitHub Pages

推送到 `main` 分支后，在仓库的 **Settings → Pages → Source** 中选择 **GitHub Actions**。工作流只发布 `dist` 文件夹。
