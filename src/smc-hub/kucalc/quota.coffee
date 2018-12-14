# computing project quotas based on settings (by admin/system) and user contributions ("upgrades")

# historical note
# old code added a "hardcoded" cpu_shares value in the setting, which was set in the DB
# we no longer have that in kucalc
# in December 2018, we removed that from the DB (LIMIT 10 to avoid locking the db too long)

###
WITH s256 AS (
    SELECT project_id
    FROM projects
    WHERE (settings ->> 'cpu_shares')::float = 256
    ORDER BY created ASC
    LIMIT 10
)
UPDATE projects AS p
SET    settings = jsonb_set(settings, '{cpu_shares}', '0')
FROM   s256
WHERE  p.project_id = s256.project_id
RETURNING p.project_id;
###

{DEFAULT_QUOTAS} = require('smc-util/upgrade-spec')
MAX_UPGRADES = require('smc-util/upgrade-spec').upgrades.max_per_project

# No matter what, every project gets SOME possibly tiny amount of guaranteed cpu.
# This is important since otherwise projects will NOT start at all, e.g., if a paying
# customer is using 100% of the cpu on the node (this will happen if their limits are
# high and they have guaranteed cpu of about 1 or more).  The project will be so slow
# it fails to start in time and times out.
MIN_POSSIBLE_CPU =
    member    : 0.05
    nonmember : 0.02

# Min possible **guaranteed** RAM.
MIN_POSSIBLE_MEMORY =
    member    : 300
    nonmember : 200

# lower bound for the RAM "limit"
# in particular, we make sure member projects are above the free quota
MIN_MEMORY_LIMIT =
    member    : 1.5 * DEFAULT_QUOTAS.memory
    nonmember : DEFAULT_QUOTAS.memory


exports.quota = (settings, users) ->
    # so can assume defined below
    settings ?= {}
    users    ?= {}

    quota =
        network        : false
        member_host    : false
        disk_quota     : DEFAULT_QUOTAS.disk_quota
        memory_limit   : DEFAULT_QUOTAS.memory   # upper bound on RAM in MB
        memory_request : 0                       # will hold guaranteed RAM in MB
        cpu_limit      : DEFAULT_QUOTAS.cores    # upper bound on vCPU's
        cpu_request    : 0           # will hold guaranteed min number of vCPU's as a float from 0 to infinity.
        privileged     : false       # for elevated docker privileges (FUSE mounting, later more)
        idle_timeout   : DEFAULT_QUOTAS.mintime

    # network access
    if settings.network  # free admin-set
        quota.network = true
    else                   # paid by some user
        for _,val of users
            if val?.upgrades?.network
                quota.network = true
                break

    # member hosting, which translates to "not pre-emptible"
    if settings.member_host  # free admin-set
        quota.member_host = true
    else                   # paid by some user
        for _,val of users
            if val?.upgrades?.member_host
                quota.member_host = true
                break

    # elevated quota for docker container (fuse mounting and maybe more ...)
    if settings.privileged
        quota.privileged = true
    # user-upgrades are disabled on purpose (security concerns and not implemented)!
    #else
    #    for _, val of users
    #        if val?.upgrades?.privileged
    #            quota.privileged = true
    #            break

    # Little helper to calculate the quotas, contributions, and limits.
    # name: of the computed quota, upgrade the quota config key,
    # parse_num for converting numbers, and factor for conversions
    calc = (name, upgrade, parse_num, factor = 1) ->
        # settings "overwrite" the default quotas
        if settings[upgrade]
            quota[name] = factor * parse_num(settings[upgrade])
            base = Math.min(quota[name], factor * MAX_UPGRADES[upgrade])
        else
            base = quota[name]
        # compute how much is left for contributed user upgrades
        remain = Math.max(0, (factor * MAX_UPGRADES[upgrade]) - base)
        contribs = 0
        for _, val of users
            contribs += factor * parse_num(val?.upgrades?[upgrade])
        contribs = Math.min(remain, contribs)
        # use quota[name], and ignore base, because admins are allowed to contribute without limits
        quota[name] += contribs

    # disk space quota in MB
    calc('disk_quota', 'disk_quota', to_int)

    # memory limit
    calc('memory_limit', 'memory', to_int)

    # idle timeout: not used for setting up the project quotas, but necessary to know for precise scheduling on nodes
    calc('idle_timeout', 'mintime', to_int)

    # memory request
    calc('memory_request', 'memory_request', to_int)

    # cpu limits
    calc('cpu_limit', 'cores', to_float)

    # cpu requests -- a special case ...
    if settings.cpu_shares
        # Subtract 256 since that's what we used to set in the database manually.
        # This isn't part of anything users pay for.
        # We should probably zero this out in the db when switching.
        quota.cpu_request = Math.max(0, to_int(settings.cpu_shares) - 256) / 1024
        delete settings.cpu_shares

    calc('cpu_request', 'cpu_shares', to_float, 1/1024)

    # ensure minimum cpu are met
    cap_lower_bound(quota, "cpu_request", MIN_POSSIBLE_CPU)

    # ensure minimum memory request is met
    cap_lower_bound(quota, "memory_request", MIN_POSSIBLE_MEMORY)

    # ensure minimum memory limit is met
    cap_lower_bound(quota, "memory_limit", MIN_MEMORY_LIMIT)

    return quota

cap_lower_bound = (quota, name, MIN_SPEC) ->
    cap = if quota.member_host then MIN_SPEC.member else MIN_SPEC.nonmember
    quota[name] = Math.max(quota[name], cap)

to_int = (s) ->
    try
        n = parseInt(s)
        if isNaN(n)
            return 0
        else
            return n
    catch
        return 0

to_float = (s) ->
    try
        x = parseFloat(s)
        if isNaN(x)
            return 0
        else
            return x
    catch
        return 0

