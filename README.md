Parshipper - parship crawler
============================
parse parship profiles

* set proper COOKIE value


get ages and sort it by count
-----------------------------
    grep Jahre  *.json | awk {'print $3'} | sort | uniq -c

