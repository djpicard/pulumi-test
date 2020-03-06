import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as datadog from "./datadog";
import * as mysql from "../../mysql";

export class Environments extends pulumi.ComponentResource {
    public dd: datadog.Datadog
    public sql: mysql.Mysql

    // base constructor
    constructor(name: string, provider: k8s.Provider, opts: {}) {
        super("kubernetes:pf:Environments", name, {}, opts)

        this.dd = new datadog.Datadog("datadog-test", {
            name: "datadog-agent",
            namespace: "default"
        }, provider, {})

        this.sql = new mysql.Mysql("mysql-test", {
            name: "mysql-test",
            namespace: "default"
        }, provider, {})

        this.registerOutputs();
    }
}
