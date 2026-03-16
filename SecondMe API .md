SecondMe API 快速入门
本指南将帮助你在 5 分钟内完成 API 接入

Copy Markdown
Open
欢迎使用 SecondMe API！本指南将帮助你在 5 分钟内完成 API 接入。

API 概述
SecondMe API 提供 SecondMe 数字分身能力，让你的应用能够：

获取用户授权的个人信息
访问用户的软记忆（个人知识库）
以用户的 AI 分身进行流式对话
Base URL: https://api.mindverse.com/gate/lab

认证方式
SecondMe API 使用 OAuth2 进行认证。你需要实现 OAuth2 授权码流程来获取 Access Token。

快速开始：使用 OAuth2
注册应用

登录 MindVerse SecondMe后台 创建 OAuth2 应用，获取 Client ID 和 Client Secret。

实现 OAuth2 流程

将用户重定向到授权页面，获取授权码，并换取 Access Token。详见 OAuth2 指南。

发起 API 请求

在请求头中添加 Authorization：


curl -X GET "https://api.mindverse.com/gate/lab/api/secondme/user/info" \
  -H "Authorization: Bearer lba_at_your_access_token"
处理响应


{
  "code": 0,
  "message": "success",
  "data": {
    "name": "用户名",
    "bio": "个人简介",
    "avatar": "https://..."
  }
}
第一个 API 调用
获取用户信息

curl -X GET "https://api.mindverse.com/gate/lab/api/secondme/user/info" \
  -H "Authorization: Bearer lba_at_your_access_token"
流式聊天

curl -X POST "https://api.mindverse.com/gate/lab/api/secondme/chat/stream" \
  -H "Authorization: Bearer lba_at_your_access_token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "你好，介绍一下自己"
  }'
响应为 Server-Sent Events 流：


event: session
data: {"sessionId": "labs_sess_xxx"}
data: {"choices": [{"delta": {"content": "你好"}}]}
data: {"choices": [{"delta": {"content": "，我是..."}}]}
data: [DONE]
权限 (Scopes)
OAuth2 需要指定权限范围：

权限	说明
user.info	访问用户基础信息（姓名、邮箱、头像等）
user.info.shades	访问用户兴趣标签
user.info.softmemory	访问用户软记忆
note.add	添加笔记和记忆
chat	访问聊天功能
voice	使用语音功能
下一步
认证概述 - 了解 OAuth2 认证方式
OAuth2 指南 - 学习 OAuth2 授权码流程
SecondMe API - 查看完整 API 参考
错误码 - 了解错误处理