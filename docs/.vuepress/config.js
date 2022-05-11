module.exports = {
  title: "证书服务器",
  description: "Just playing around",
  themeConfig: {
    nav: [
      { text: "主页", link: "/" },
      { text: "开发指南", link: "/src/guide/" },
      {
        text: "项目说明",
        ariaLabel: "/",
        items: [
          { text: "前端", link: "/webapp/" },
          { text: "后端", link: "/app/" },
        ],
      },
      { text: "TODO", link: "/src/TODO/" },
    ],
    sidebar: {
      "/src/guide/": ["lerna", "release", "temp"],
    },
  },
};
