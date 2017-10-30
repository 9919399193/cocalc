###############################################################################
#
#    CoCalc: Collaborative Calculation in the Cloud
#
#    Copyright (C) 2014 -- 2016, SageMath, Inc.
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
###############################################################################


###############################################################################
#
# This should be the last code run on client application startup.
#
###############################################################################

$               = window.$
{webapp_client} = require('./webapp_client')
{redux}         = require('./smc-react')
misc            = require('smc-util/misc')

# see http://stackoverflow.com/questions/12197122/how-can-i-prevent-a-user-from-middle-clicking-a-link-with-javascript-or-jquery
# I have some concern about performance.
$(document).on "click", (e) ->
    if e.button == 1 and $(e.target).hasClass("webapp-no-middle-click")
        e.preventDefault()
        e.stopPropagation() # ?
    # hide popover on click
    if $(e.target).data('toggle') != 'popover' and $(e.target).parents('.popover.in').length == 0
        $('[data-toggle="popover"]').popover('hide')

remember_me = webapp_client.remember_me_key()
if window.smc_target and not misc.get_local_storage(remember_me) and window.smc_target != 'login'
    require('./history').load_target(window.smc_target)
else
    redux.getActions('page').set_active_tab('account')

client = webapp_client
if client._connected
    # These events below currently (due to not having finished the react rewrite)
    # have to be emited after the page loads, but may happen before.
    client.emit('connected')
    if client._signed_in
        client.emit("signed_in", client._sign_in_mesg)

# mathjax configuration: this could be cleaned up further or even parameterized with some code during startup

# ATTN: do not use "xypic.js", frequently causes crash!
window.MathJax = exports.MathJaxConfig =
    skipStartupTypeset: true
    extensions: ["tex2jax.js","asciimath2jax.js"]  # "static/mathjax_extensions/xypic.js"
    # NOTE: "output/CommonHTML" is the output default: http://docs.mathjax.org/en/latest/output.html
    # However, **DO NOT** use "output/CommonHTML" for the output JAX; it completely breaks
    # Sage worksheet output right now.  Maybe when/if worksheets are rewritten
    # using React, we can change, but not now.  Using "output/SVG" works just fine.
    #   https://github.com/sagemathinc/cocalc/issues/1962
    jax: ["input/TeX","input/AsciiMath", "output/SVG"]
    # http://docs.mathjax.org/en/latest/options/tex2jax.html
    tex2jax:
        inlineMath     : [ ['$','$'], ["\\(","\\)"] ]
        displayMath    : [ ['$$','$$'], ["\\[","\\]"] ]
        processEscapes : true
        ignoreClass    : "tex2jax_ignore"
        skipTags       : ["script","noscript","style","textarea","pre","code"]

    TeX:
        MAXBUFFER  : 100000  # see https://github.com/mathjax/MathJax/issues/910
        extensions : ["autoload-all.js", "noUndefined.js", "noErrors.js"]
        Macros     : # get these from sage/misc/latex.py
            Bold  : ["\\mathbb{#1}",1]
            ZZ    : ["\\Bold{Z}",0]
            NN    : ["\\Bold{N}",0]
            RR    : ["\\Bold{R}",0]
            CC    : ["\\Bold{C}",0]
            FF    : ["\\Bold{F}",0]
            QQ    : ["\\Bold{Q}",0]
            QQbar : ["\\overline{\\QQ}",0]
            CDF   : ["\\Bold{C}",0]
            CIF   : ["\\Bold{C}",0]
            CLF   : ["\\Bold{C}",0]
            RDF   : ["\\Bold{R}",0]
            RIF   : ["\\Bold{I} \\Bold{R}",0]
            RLF   : ["\\Bold{R}",0]
            CFF   : ["\\Bold{CFF}",0]
            GF    : ["\\Bold{F}_{#1}",1]
            Zp    : ["\\ZZ_{#1}",1]
            Qp    : ["\\QQ_{#1}",1]
            Zmod  : ["\\ZZ/#1\\ZZ",1]
        noErrors:  # http://docs.mathjax.org/en/latest/tex.html#noerrors
            inlineDelimiters : ["$","$"]
            multiLine        : true
            style:
                "font-size"  : "85%"
                "text-align" : "left"
                "color"      : "red"
                "padding"    : "1px 3px"
                "background" : "#FFEEEE"
                "border"     : "none"
        noUndefined:  # http://docs.mathjax.org/en/latest/tex.html#noundefined
            attributes:
                mathcolor      : "red"
                mathbackground : "#FFEEEE"
                mathsize       : "90%"

    # do not use "xypic.js", frequently causes crash!
    "HTML-CSS":
        linebreaks:
            automatic: true
    SVG:
        linebreaks:
            automatic: true
    showProcessingMessages: false

$ = window.$
$("#smc-startup-banner")?.remove()
$('#smc-startup-banner-status')?.remove()
$ ->
    $(parent).trigger('initialize:frame')

    # dynamically inserting the mathjax script URL
    mjscript = document.createElement("script")
    mjscript.type = "text/javascript"
    mjscript.src  = MATHJAX_URL
    mjscript.onload = ->
        {mathjax_finish_startup} = require('./misc_page')
        MathJax.Hub?.Queue([mathjax_finish_startup])
    document.getElementsByTagName("head")[0].appendChild(mjscript)

    # enable logging
    misc.wrap_log()

    # for commercial setup, enable conversion tracking
    if require('./customize').commercial
        theme = require('smc-util/theme')
        # the gtag initialization
        window.dataLayer = window.dataLayer || []
        window.gtag = ->
            dataLayer.push(arguments)
        window.gtag('js', new Date())
        window.gtag('config', theme.gtag_id)
        # load tagmanager
        jtag = document.createElement("script")
        jtag.src = "https://www.googletagmanager.com/gtag/js?id=#{theme.gtag_id}"
        jtag.async = true
        document.getElementsByTagName("head")[0].appendChild(jtag)

    # finally, record start time
    # TODO compute an report startup initialization time
    prom_client = require('./prom-client')
    if prom_client.enabled
        startup_time_gauge = prom_client.new_gauge('startup_time', 'When the webapp started')
        startup_time_gauge.set(misc.get_start_time_ts().getTime())
        browser_info_gauge = prom_client.new_gauge('browser_info', 'Information about the browser', ['browser', 'mobile', 'touch', 'git_version'])
        feature = require('./feature')
        browser_info_gauge.labels(feature.get_browser(), feature.IS_MOBILE, feature.IS_TOUCH, (SMC_GIT_REV ? 'N/A')).set(1)
        initialization_time_gauge = prom_client.new_gauge('initialization_seconds', 'Time from loading app.html page until last.coffee is completely done')
        initialization_time_gauge.set(((new Date()).getTime() - window.webapp_initial_start_time) / 1000)
