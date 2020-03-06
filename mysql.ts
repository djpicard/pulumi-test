import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as defaults from "../interfaces/interfaces";

export class Mysql extends pulumi.ComponentResource {
   public pvc: k8s.core.v1.PersistentVolumeClaim
   public secrets: k8s.core.v1.Secret
   public deploy: k8s.apps.v1.Deployment
   public service: k8s.core.v1.Service
   private settings: defaults.Environments

   // base constructor
   constructor(name: string, settings: defaults.Environments, provider: k8s.Provider, opts: {}) {
      // Implement pulumi Component Resource with our name
      super("kubernetes:peerfit:Mysql", name, {}, opts)
      this.settings = settings

      this.pvc = new k8s.core.v1.PersistentVolumeClaim("mysql-pvc", {
         metadata: {
            name: "mysql",
            namespace: this.settings.namespace
         },
         spec: {
            accessModes: ["ReadWriteOnce"],
            resources: {
               requests: {
                  storage: "100G"
               }
            }
         }
      }, { provider: provider })

      this.secrets = new k8s.core.v1.Secret("mysql", {
         metadata: {
            name: "mysql",
            namespace: this.settings.namespace
         },
         type: "Opaque",
         data: {
            "mysql-root-password": "eGkzMzRPdnIxdg==",
            "mysql-password": "ZXFKM2dDQUtWRA=="
         }
      }, { provider: provider })

      this.service = new k8s.core.v1.Service("mysql", {
         metadata: {
            name: "mysql",
            namespace: this.settings.namespace
         },
         spec: {
            type: "ClusterIP",
            ports: [{
               name: "mysql",
               port: 3306,
               targetPort: "mysql"
            }],
            selector: {
               "app": "mysql"
            }
         }
      }, { provider: provider })

      this.deploy = new k8s.apps.v1.Deployment("mysql", {
         metadata: {
            name: "mysql",
            namespace: this.settings.namespace
         },
         spec: {
            strategy: {
               type: "Recreate"
            },
            selector: {
               matchLabels: {
                  "app": "mysql",
                  "release": "mysql"
               }
            },
            template: {
               metadata: {
                  labels: {
                     "app": "mysql",
                     "release": "mysql"
                  }
               },
               spec: {
                  serviceAccountName: "default",
                  initContainers: [
                     {
                        name: "remove-lost-found",
                        image: "busybox:1.29.3",
                        imagePullPolicy: "Always",
                        resources: {
                           requests: {
                              cpu: "10m",
                              memory: "10Mi"
                           }
                        },
                        command: [
                           "rm",
                           "-fr",
                           "/var/lib/mysql/lost+found"
                        ],
                        volumeMounts: [
                           {
                              name: "data",
                              mountPath: "/var/lib/mysql"
                           }
                        ]
                     }
                  ],
                  containers: [
                     {
                        name: "mysql",
                        image: "gcr.io/peerfit-149019/infra_mysql:master",
                        imagePullPolicy: "Always",
                        resources: {
                           requests: {
                              cpu: "100m",
                              memory: "256Mi"
                           }
                        },
                        env: [
                           {
                              name: "MYSQL_ROOT_PASSWORD",
                              valueFrom: {
                                 secretKeyRef: {
                                    name: "mysql",
                                    key: "mysql-root-password"
                                 }
                              }
                           },
                           {
                              name: "MYSQL_PASSWORD",
                              valueFrom: {
                                 secretKeyRef: {
                                    name: "mysql",
                                    key: "mysql-password",
                                    optional: true
                                 }
                              }
                           },
                           {
                              name: "MYSQL_USER",
                              value: ""
                           },
                           {
                              name: "MYSQL_DATABASE",
                              value: "peerfit"
                           }
                        ],
                        ports: [
                           {
                              name: "mysql",
                              containerPort: 3306
                           }
                        ],
                        livenessProbe: {
                           exec: {
                              command: [
                                 "sh",
                                 "-c",
                                 "mysqladmin ping -u root -p${MYSQL_ROOT_PASSWORD}"
                              ]
                           },
                           initialDelaySeconds: 30,
                           periodSeconds: 10,
                           timeoutSeconds: 5,
                           successThreshold: 1,
                           failureThreshold: 3
                        },
                        readinessProbe: {
                           exec: {
                              command: [
                                 "sh",
                                 "-c",
                                 "mysqladmin ping -u root -p${MYSQL_ROOT_PASSWORD}"
                              ]
                           },
                           initialDelaySeconds: 5,
                           periodSeconds: 10,
                           timeoutSeconds: 1,
                           successThreshold: 1,
                           failureThreshold: 3
                        },
                        volumeMounts: [
                           {
                              name: "data",
                              mountPath: "/var/lib/mysql"
                           }
                        ]
                     }
                  ],
                  volumes: [
                     {
                        name: "data",
                        persistentVolumeClaim: {
                           claimName: "mysql"
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
