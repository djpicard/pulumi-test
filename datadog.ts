import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as defaults from "../interfaces/interfaces";

export class Datadog extends pulumi.ComponentResource {
    public serviceAccount: k8s.core.v1.ServiceAccount
    public clusterRoleBinding: k8s.rbac.v1.ClusterRoleBinding
    public clusterRole: k8s.rbac.v1.ClusterRole
    public daemonset: k8s.apps.v1.DaemonSet
    public service: k8s.core.v1.Service
    private settings: defaults.Environments

    // base constructor
    constructor(name: string, settings: defaults.Environments, provider: k8s.Provider, opts: {}) {
        // Implement pulumi Component Resource with our name
        super("kubernetes:peerfit:Datadog", name, {}, opts)
        this.settings = settings

        // Create Datadog Service Account
        this.serviceAccount = new k8s.core.v1.ServiceAccount("datadog-agent", {
            metadata: {
                namespace: this.settings.namespace,
                name: "datadog-agent"
            }
        }, { provider: provider })

        // Create Cluster Role Binding to allow Datadog to function properly
        this.clusterRoleBinding = new k8s.rbac.v1.ClusterRoleBinding("datadog-agent", {
            metadata: {
                name: "datadog-agent"
            },
            roleRef: {
                apiGroup: "rbac.authorization.k8s.io",
                kind: "ClusterRole",
                name: "datadog-agent"
            },
            subjects: [{
                kind: "ServiceAccount",
                name: "datadog-agent",
                namespace: this.settings.namespace
            }]
        }, { provider: provider })

        // Define the role that Datadog will use
        this.clusterRole = new k8s.rbac.v1.ClusterRole("datadog-agent", {
            metadata: {
                name: "datadog-agent"
            },
            rules: [
                {
                    apiGroups: [""],
                    resources: ["services", "events", "endpoints", "pods", "nodes", "componentstatuses"],
                    verbs: ["get", "watch", "list"]
                },
                {
                    apiGroups: ["quota.openshift.io"],
                    resources: ["clusterresourcequotas"],
                    verbs: ["get", "list"]
                },
                {
                    apiGroups: [""],
                    resources: ["configmaps"],
                    resourceNames: ["datadogtoken", "datadog-leader-election"],
                    verbs: ["get", "update"]
                },
                {
                    apiGroups: [""],
                    resources: ["configmaps"],
                    verbs: ["create"]
                },
                {
                    nonResourceURLs: ["/version", "/healthz", "/metrics"],
                    verbs: ["get"]
                },
                {
                    apiGroups: [""],
                    resources: ["nodes/metrics", "nodes/spec", "nodes/proxy", "nodes/stats"],
                    verbs: ["get"]
                }
            ]
        }, { provider: provider })

        this.service = new k8s.core.v1.Service("datadog-agent", {
            metadata: {
                name: "datadog-agent",
                namespace: this.settings.namespace
            },
            spec: {
                ports: [{
                    name: "traceport",
                    port: 8126,
                    protocol: "TCP",
                    targetPort: 8126
                },
                {
                    name: "dogstatsdport",
                    port: 8125,
                    protocol: "UDP",
                    targetPort: 8125
                }],

                selector: {
                    app: "datadog-agent"
                },

                type: "ClusterIP"
            }
        }, { provider: provider })

        // Create the Daemonset that Datadog will use
        this.daemonset = new k8s.apps.v1.DaemonSet("datadog-agent", {
            metadata: {
                name: "datadog-agent",
                namespace: this.settings.namespace
            },
            spec: {
                selector: {
                    matchLabels: {
                        app: "datadog-agent"
                    },
                },
                template: {
                    metadata: {
                        labels: {
                            "app": "datadog-agent"
                        },
                        name: "datadog-agent",
                        annotations: {
                            "container.apparmor.security.beta.kubernetes.io/system-probe": "unconfined"
                        }
                    },
                    spec: {
                        hostNetwork: true,
                        serviceAccountName: "datadog-agent",
                        containers: [
                            {
                                image: "datadog/agent:latest",
                                imagePullPolicy: "Always",
                                name: "datadog-agent",
                                ports: [
                                    {
                                        containerPort: 8125,
                                        hostPort: 8125,
                                        name: "dogstatsdport",
                                        protocol: "UDP"
                                    },
                                    {
                                        containerPort: 8126,
                                        hostPort: 8126,
                                        name: "traceport",
                                        protocol: "TCP"
                                    }
                                ],
                                env: [
                                    {
                                        name: "DD_API_KEY",
                                        value: "
                                    },
                                    {
                                        name: "KUBERNETES",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_HEALTH_PORT",
                                        value: "5555"
                                    },
                                    {
                                        name: "DD_PROCESS_AGENT_ENABLED",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_SYSTEM_PROBE_ENABLED",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_SYSTEM_PROBE_EXTERNAL",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_SYSPROBE_SOCKET",
                                        value: "/var/run/s6/sysprobe.sock"
                                    },
                                    {
                                        name: "DD_DOGSTATSD_NON_LOCAL_TRAFFIC",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_COLLECT_KUBERNETES_EVENTS",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_LEADER_ELECTION",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_APM_ENABLED",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_APM_NON_LOCAL_TRAFFIC",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_TRACE_ANALYTICS_ENABLED",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_KUBERNETES_KUBELET_HOST",
                                        valueFrom: {
                                            fieldRef: {
                                                "fieldPath": "status.hostIP"
                                            }
                                        }
                                    },
                                    {
                                        name: "DD_LOGS_ENABLED",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_AC_EXCLUDE",
                                        value: "name:datadog-agent"
                                    }
                                ],
                                resources: {
                                    requests: {
                                        memory: "1000Mi",
                                        cpu: "500m"
                                    },
                                    limits: {
                                        memory: "4000Mi",
                                        cpu: "2000m"
                                    }
                                },
                                volumeMounts: [
                                    {
                                        name: "dockersocket",
                                        mountPath: "/var/run/docker.sock"
                                    },
                                    {
                                        name: "procdir",
                                        mountPath: "/host/proc",
                                        readOnly: true
                                    },
                                    {
                                        name: "cgroups",
                                        mountPath: "/host/sys/fs/cgroup",
                                        readOnly: true
                                    },
                                    {
                                        name: "debugfs",
                                        mountPath: "/sys/kernel/debug"
                                    },
                                    {
                                        name: "s6-run",
                                        mountPath: "/var/run/s6"
                                    }
                                ],
                                livenessProbe: {
                                    httpGet: {
                                        path: "/health",
                                        port: 5555
                                    },
                                    initialDelaySeconds: 15,
                                    periodSeconds: 15,
                                    timeoutSeconds: 5,
                                    successThreshold: 1,
                                    failureThreshold: 3
                                }
                            },
                            {
                                name: "system-probe",
                                image: "datadog/agent:7.16.0",
                                imagePullPolicy: "Always",
                                securityContext: {
                                    capabilities: {
                                        add: [
                                            "SYS_ADMIN",
                                            "SYS_RESOURCE",
                                            "SYS_PTRACE",
                                            "NET_ADMIN"
                                        ]
                                    }
                                },
                                command: [
                                    "/opt/datadog-agent/embedded/bin/system-probe"
                                ],
                                env: [
                                    {
                                        name: "DD_SYSTEM_PROBE_ENABLED",
                                        value: "true"
                                    },
                                    {
                                        name: "DD_SYSPROBE_SOCKET",
                                        value: "/var/run/s6/sysprobe.sock"
                                    }
                                ],
                                resources: {
                                    requests: {
                                        memory: "150Mi",
                                        cpu: "200m"
                                    },
                                    limits: {
                                        memory: "150Mi",
                                        cpu: "200m"
                                    }
                                },
                                volumeMounts: [
                                    {
                                        name: "procdir",
                                        mountPath: "/host/proc",
                                        readOnly: true
                                    },
                                    {
                                        name: "cgroups",
                                        mountPath: "/host/sys/fs/cgroup",
                                        readOnly: true
                                    },
                                    {
                                        name: "debugfs",
                                        mountPath: "/sys/kernel/debug"
                                    },
                                    {
                                        name: "s6-run",
                                        mountPath: "/var/run/s6"
                                    }
                                ]
                            }
                        ],
                        volumes: [
                            {
                                name: "dockersocket",
                                hostPath: {
                                    path: "/var/run/docker.sock"
                                }
                            },
                            {
                                name: "procdir",
                                hostPath: {
                                    path: "/proc"
                                }
                            },
                            {
                                name: "cgroups",
                                hostPath: {
                                    path: "/sys/fs/cgroup"
                                }
                            },
                            {
                                name: "s6-run",
                                emptyDir: {}
                            },
                            {
                                name: "debugfs",
                                hostPath: {
                                    path: "/sys/kernel/debug"
                                }
                            }
                        ]
                    }
                }
            }
        }, { provider: provider })

        this.registerOutputs();
    }
}
