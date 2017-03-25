#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

var exportFile = process.argv[2];

exportFile = 'export.json';

if (!exportFile) {
  console.error('missing export file');
  process.exit();
}

var resolvedExportFile;
if (!/^\//.test(exportFile)) {
  resolvedExportFile = path.resolve('./', exportFile);
} else {
  resolvedExportFile = exportFile;
}

console.log('start migrate export file:', resolvedExportFile);

getDisqusWxr(resolvedExportFile);

function getDisqusWxr(exportFile) {
  var start = `
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dsq="http://www.disqus.com/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.0/"
>
  <channel>
  `;
  var end = `
  </channel>
</rss>
  `;

  try {
    var raw = require(exportFile);
  } catch (e) {
    console.log(e);
    process.exit();
  }

  var threadMap = {};
  var commentsMap = {};

  var threads = raw.threads;

  populateThreadMap(threadMap, raw.threads);
  populateCommentsMap(commentsMap, raw.posts);

  var disqusXml = path.join(path.dirname(exportFile), 'disqus.xml');

  console.log(disqusXml);

  var items = getItems(threads);

  fs.writeFile(disqusXml, start + items + end, function () {
    console.log('migrate success', arguments);
  });

  function populateThreadMap(threadMap, threads){
    threads.forEach(function(thread){
      threadMap[thread.thread_id] = thread;
      threadMap[thread.thread_id].comments = [];
    });
  }

  function populateCommentsMap(commentsMap, comments){
    comments.forEach(function(comment){
      commentsMap[comment.post_id] = comment;

      var thread = threadMap[comment.thread_id];
      if (thread && thread.comments.indexOf(comment) < 0) {
        thread.comments.push(comment);
      }
    });
  }

  function getItems(threads) {
    return threads.map(getItem).join('\n');
  }

  function getItem(thread) {
    return `
    <item>
      <!-- title of article -->
      <title>${thread.title || ''}</title>
      <!-- absolute URI to article -->
      <link>${thread.url}</link>
      <!-- body of the page or post; use cdata; html allowed (though will be formatted to DISQUS specs) -->
      <content:encoded><![CDATA[]]></content:encoded>
      <!-- value used within disqus_identifier; usually internal identifier of article -->
      <dsq:thread_identifier>${thread.thread_key}</dsq:thread_identifier>
      <!-- creation date of thread (article), in GMT. Must be YYYY-MM-DD HH:MM:SS 24-hour format. -->
      <wp:post_date_gmt>${thread.created_at}</wp:post_date_gmt>
      <!-- open/closed values are acceptable -->
      <wp:comment_status>open</wp:comment_status>
      ${getComments(thread.comments)}
    </item>
      `;
  }

  function getComments(comments) {
    return comments.map(getComment).join('\n');
  }

  function getComment(comment) {
    return `
      <wp:comment>
        <!-- sso only; see docs -->
        <!-- <dsq:remote> -->
          <!-- unique internal identifier; username, user id, etc. -->
          <!-- <dsq:id>user id</dsq:id> -->
          <!-- avatar -->
          <!-- <dsq:avatar>http://url.to/avatar.png</dsq:avatar> -->
        <!-- </dsq:remote> -->
        <!-- internal id of comment -->
        <wp:comment_id>${comment.post_id}</wp:comment_id>
        <!-- author display name -->
        <wp:comment_author>${comment.author_name}</wp:comment_author>
        <!-- author email address -->
        <wp:comment_author_email>${comment.author_email}</wp:comment_author_email>
        <!-- author url, optional -->
        <wp:comment_author_url>${comment.author_url || ''}</wp:comment_author_url>
        <!-- author ip address -->
        <wp:comment_author_IP>${comment.ip}</wp:comment_author_IP>
        <!-- comment datetime, in GMT. Must be YYYY-MM-DD HH:MM:SS 24-hour format. -->
        <wp:comment_date_gmt>${comment.created_at}</wp:comment_date_gmt>
        <!-- comment body; use cdata; html allowed (though will be formatted to DISQUS specs) -->
        <wp:comment_content><![CDATA[${comment.message}]]></wp:comment_content>
        <!-- is this comment approved? 0/1 -->
        <wp:comment_approved>1</wp:comment_approved>
        <!-- parent id (match up with wp:comment_id) -->
        <wp:comment_parent>${getCommentParent(comment.parents)}</wp:comment_parent>
      </wp:comment>
  `;
  }

  function getCommentParent(parents) {
    if (!parents) {
      return '';
    }

    if (!parents.length) {
      return '';
    }

    for (var i = parents.length - 1; i >= 0; i--) {
      if (commentsMap[parents[i]]) {
        return parents[i];
      }
    }

    return '';
  }
}
