# Moving a TinyMCE project to NovaProse

`project/` is a small TinyMCE project: a page that loads TinyMCE from Tiny Cloud, and a module that
imports the `tinymce` package with its theme, icons and plugins.

```bash
npm install
npm run migrate        # the report: what would change, what is left to do by hand
npm run migrate:write  # make the changes, then look at the files in project/
```

`npm run migrate` is `npx @novaprose/tinymce-compat migrate project`: run the same command in your
own project (in its folder, `npx @novaprose/tinymce-compat migrate`). See
[Migrating from TinyMCE](https://novaprose.com/guides/migrating-from-tinymce/#or-let-a-command-do-it).
