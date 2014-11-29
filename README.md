Parshipper - parship crawler
============================
parse parship profiles


configuration
-------------
* copy config.default.json to config.json
* logon in parship - copy your cookie
* paste cookie value under session.cookie
* run script


run script
----------

```sh
node parshipper.js <params>
```

* Params:
    *    getnew <pagesCount> - get new suggest profiles and share your images with them
    *   resync <useCache:true> - resync profile data based on cached profile Ids
    *   parse <profileId> - parse profile data with




get ages and sort it by count
-----------------------------
    grep Jahre  *.json | awk {'print $3'} | sort | uniq -c

