# 3rd Party Libraries

# Internal Libraries
{React, rtypes} = require('../smc-react')
{webapp_client} = require('../webapp_client')

# Sibling Libraries
util = require('./util')
{get_store_def} = require('./store')
{ChatActions} = require('./actions')
{ChatRoom} = require('../smc_chat')

exports.init = init = (path, redux, project_id) ->
    name = util.generate_name(project_id, path)
    if redux.getActions(name)?
        return name  # already initialized

    actions = redux.createActions(name, ChatActions)
    store   = redux.createStore(get_store_def(name))

    syncdb = webapp_client.sync_db
        project_id   : project_id
        path         : path
        primary_keys : ['date']
    syncdb.once 'init', (err) =>
        if err
            mesg = "Error opening '#{path}' -- #{err}"
            console.warn(mesg)
            alert_message(type:"error", message:mesg)
            return
        actions.syncdb = syncdb
        actions.store = store
        actions.init_from_syncdb()
        syncdb.on('change', actions._syncdb_change)
        redux.getProjectActions(project_id)?.log_opened_time(path)
    return name

exports.remove = remove = (path, redux, project_id) ->
    name = util.generate_name(project_id, path)
    actions = redux.getActions(name)
    actions?.syncdb?.close()
    store = redux.getStore(name)
    if not store?
        return
    delete store.state
    # It is *critical* to first unmount the store, then the actions,
    # or there will be a huge memory leak.
    redux.removeStore(name)
    redux.removeActions(name)
    return name

ChatEditorGenerator = (path, redux, project_id) ->
    name = util.generate_name(project_id, path)
    C_ChatRoom = ({actions}) ->
        <ChatRoom
            redux       = {redux}
            path        = {path}
            name        = {name}
            actions     = {actions}
            project_id  = {project_id}
            />

    C_ChatRoom.propTypes =
        actions : rtypes.object.isRequired

    return C_ChatRoom

require('../project_file').register_file_editor
    ext       : 'sage-chat'
    icon      : 'comment'
    init      : init
    generator : ChatEditorGenerator
    remove    : remove
