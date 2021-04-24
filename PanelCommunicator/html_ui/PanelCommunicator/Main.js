class PanelCommunicator {
    constructor(port) {
        this.port = port ? port : 29385

        this.socketConnected = false
        this.socket = null
        // {[varName: string]: {units: string, value: number}}
        this.allVars = {}
        this.pollLoop = null

        this.processMessage = this.processMessage.bind(this)
        this.disconnected = this.disconnected.bind(this)
        this.connectWebsocket = this.connectWebsocket.bind(this)
        this.pollVars = this.pollVars.bind(this)
        this.connected = this.connected.bind(this)
    }

    // Fetches all watching vars and returns the ones that have changed or null if nothing did
    updateVars() {
        let changedVars = {}
        let didChange = false

        for (const varName in this.allVars) {
            const currentData = this.allVars[varName]
            const newValue = SimVar.GetSimVarValue(varName, currentData.units)

            if (currentData.value !== newValue) {
                didChange = true
                changedVars[varName] = newValue
            }

            this.allVars[varName].value = newValue
        }

        return didChange ? changedVars : null
    }

    processInteraction(interactionName) {
        var panel = window.document.getElementById("panel");
        
        if (panel) {
            for (var i = 0; i < panel.children.length; i++) {
                var instrument = panel.children[i];
                if (instrument) {
                    instrument.onInteractionEvent([interactionName]);
                }
            }
        }
    }

    processMessage(event) {
        const message = JSON.parse(event.data)
        
        switch (message.type) {
            case "get": 
                this.sendMessage("getResult", {
                    value: SimVar.GetSimVarValue(message.data.name, this.nullBlank(message.data.units))
                })
                break;
            case "set": 
                SimVar.SetSimVarValue(message.data.name, this.nullBlank(message.data.units), message.data.value)
                break;
            case "watch": 
                this.allVars[message.data.name] = {units: this.nullBlank(message.data.units), value: 0}
                break;
            case "remove": 
                delete this.allVars[message.data.name]
                break;
            case "clear": 
                this.allVars = {}
                break;
            case "interaction":
                this.processInteraction(message.data.name)
                break;
        }
    }

    sendMessage(type, data) {
        this.socket.send(JSON.stringify({type, data}))
    }

    pollVars() {
        const changedVars = this.updateVars()
        // Socket could've been disconnected
        if (this.socket && changedVars != null) {
            this.sendMessage("watchResult", changedVars)
        }
    }

    connected() {
        this.socketConnected = true
        this.pollLoop = setInterval(this.pollVars, 150) // ~6hz
    }

    disconnected() {
        // Indicate connection has been lost and should be retried
        this.socketConnected = false
        this.socket = null
        // Clear all watching vars
        this.allVars = {}
        // Stop polling
        clearInterval(this.pollLoop)
    }

    connectWebsocket() {
        if (this.socketConnected) {return}
        this.socket = new WebSocket("ws://127.0.0.1:" + this.port)

        this.socket.addEventListener("open", this.connected)
        this.socket.addEventListener("message", this.processMessage)
        this.socket.addEventListener("close", this.disconnected)
        this.socket.addEventListener("error", this.disconnected)
    }

    nullBlank(object) {
        return object ? object : ""
    }

    run() {
        setInterval(this.connectWebsocket, 3000)
    }
}

new PanelCommunicator().run()