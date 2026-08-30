const LIMITE_FOTO_FIRESTORE = 650000;
function carregarImagemFonte(fonte){
    return new Promise((resolve, reject) => {
        const imagem = new Image();
        imagem.onload = () => resolve(imagem);
        imagem.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
        imagem.src = fonte;
    });
}
function gerarFotoComprimida(
    imagem,
    tamanhoMaximo,
    qualidade
){

    let largura =
        imagem.width;


    let altura =
        imagem.height;


    if(
        largura > tamanhoMaximo
        ||
        altura > tamanhoMaximo
    ){

        const proporcao =
            Math.min(
                tamanhoMaximo / largura,
                tamanhoMaximo / altura
            );


        largura =
            Math.round(
                largura * proporcao
            );


        altura =
            Math.round(
                altura * proporcao
            );

    }


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        largura;


    canvas.height =
        altura;


    const contexto =
        canvas.getContext(
            "2d"
        );


    contexto.drawImage(
        imagem,
        0,
        0,
        largura,
        altura
    );


    return canvas.toDataURL(
        "image/jpeg",
        qualidade
    );

}


/*
 * Vai reduzindo qualidade/tamanho
 * até a imagem caber confortavelmente
 * em um documento do Firestore.
 */
async function comprimirImagemParaFirestore(
    imagem
){

    let tamanhoMaximo =
        500;


    let qualidade =
        0.82;


    let foto =
        "";


    for(
        let tentativa = 0;
        tentativa < 12;
        tentativa++
    ){

        foto =
            gerarFotoComprimida(
                imagem,
                tamanhoMaximo,
                qualidade
            );


        if(
            foto.length <=
            LIMITE_FOTO_FIRESTORE
        ){

            return foto;

        }


        /*
         * Primeiro reduz qualidade.
         */
        if(
            qualidade > 0.50
        ){

            qualidade -=
                0.07;

        }else{

            /*
             * Se ainda estiver grande,
             * reduz também a resolução.
             */
            tamanhoMaximo =
                Math.max(
                    220,
                    Math.round(
                        tamanhoMaximo * 0.85
                    )
                );


            qualidade =
                0.72;

        }

    }


    throw new Error(
        "A imagem continua grande demais mesmo após a compressão."
    );

}


/*
 * Foto nova escolhida pelo usuário.
 */
window.prepararFotoParaFirestore =
async function(arquivo){

    const url =
        URL.createObjectURL(
            arquivo
        );


    try{

        const imagem =
            await carregarImagemFonte(
                url
            );


        return await comprimirImagemParaFirestore(
            imagem
        );


    }finally{

        URL.revokeObjectURL(
            url
        );

    }

};


/*
 * Usada para migrar as fotos antigas
 * que já estão em formato dataURL.
 */
window.prepararDataURLFotoFirestore =
async function(foto){

    if(
        typeof foto !== "string"
        ||
        !foto.startsWith(
            "data:image/"
        )
    ){

        throw new Error(
            "Formato de foto inválido."
        );

    }


    if(
        foto.length <=
        LIMITE_FOTO_FIRESTORE
    ){

        return foto;

    }


    const imagem =
        await carregarImagemFonte(
            foto
        );


    return await comprimirImagemParaFirestore(
        imagem
    );

};


/*
 * Salva a foto separadamente
 * da ficha.
 */
window.salvarFotoFichaFirestore =
async function(
    ficha,
    foto
){

    const usuario =
        auth.currentUser;


    if(
        !usuario
        ||
        !ficha
    ){

        throw new Error(
            "Usuário ou ficha inválidos."
        );

    }


    /*
     * Primeiro garantimos que a ficha
     * principal já exista.
     *
     * Isso é especialmente importante
     * para uma ficha recém-criada
     * por um jogador.
     */
    if(
        window.papelUsuario ===
        "jogador"
    ){

        if(
            typeof window
                .salvarFichaJogadorNoFirestore
            === "function"
        ){

            const sucesso =
                await window
                    .salvarFichaJogadorNoFirestore(
                        ficha
                    );


            if(sucesso === false){

                throw new Error(
                    "Não foi possível salvar a ficha antes da foto."
                );

            }

        }

    }else if(
        window.papelUsuario ===
        "mestre"
    ){

        if(
            typeof window
                .salvarFichaMestreNoFirestore
            === "function"
        ){

            await window
                .salvarFichaMestreNoFirestore(
                    ficha
                );

        }

    }else{

        throw new Error(
            "Tipo de usuário inválido."
        );

    }


    const fotoFinal =
        await window
            .prepararDataURLFotoFirestore(
                foto
            );


    await db
        .collection(
            "fotosFichas"
        )
        .doc(
            String(ficha.id)
        )
        .set({

            foto:
                fotoFinal,

            atualizadoEm:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp()

        });


    /*
     * Também mantém a foto na memória
     * enquanto esta página estiver aberta.
     */
    ficha.foto =
        fotoFinal;


    return fotoFinal;

};


/*
 * Carrega as fotos correspondentes
 * às fichas que o usuário já pode ver.
 */
window.carregarFotosDasFichas =
async function(fichas){

    if(
        !Array.isArray(fichas)
        ||
        fichas.length === 0
    ){
        return;
    }


    await Promise.all(
        fichas.map(
            async ficha => {

                try{

                    const documento =
                        await db
                            .collection(
                                "fotosFichas"
                            )
                            .doc(
                                String(
                                    ficha.id
                                )
                            )
                            .get();


                    if(
                        documento.exists
                    ){

                        const dados =
                            documento.data();


                        ficha.foto =
                            typeof dados.foto
                                === "string"
                            ? dados.foto
                            : "";

                    }else{

                        ficha.foto =
                            "";

                    }


                }catch(erro){

                    console.error(
                        "Erro ao carregar foto da ficha:",
                        ficha.id,
                        erro
                    );


                    ficha.foto =
                        "";

                }

            }
        )
    );
};

async function migrarFotosAntigasLocalStorage(){

    if(
        window.papelUsuario !==
        "mestre"
    ){

        return;

    }


    const usuario =
        auth.currentUser;


    if(!usuario){

        return;

    }


    /*
     * Primeiro tentamos o banco
     * específico do Mestre.
     *
     * Depois usamos o banco antigo
     * global como reserva.
     */
    const chaves = [

        "BancoFichasRPG_" +
        usuario.uid,

        "BancoFichasRPG"

    ];


    const fotosEncontradas =
        new Map();


    for(
        const chave
        of chaves
    ){

        const salvo =
            localStorage.getItem(
                chave
            );


        if(!salvo){
            continue;
        }


        try{

            const dados =
                JSON.parse(
                    salvo
                );


            if(
                !dados
                ||
                !Array.isArray(
                    dados.fichas
                )
            ){

                continue;

            }


            dados.fichas.forEach(
                ficha => {

                    const id =
                        String(
                            ficha.id
                        );


                    if(
                        fotosEncontradas
                            .has(id)
                    ){

                        return;

                    }


                    if(
                        typeof ficha.foto
                            === "string"
                        &&
                        ficha.foto.startsWith(
                            "data:image/"
                        )
                    ){

                        fotosEncontradas.set(
                            id,
                            ficha.foto
                        );

                    }

                }
            );


        }catch(erro){

            console.error(
                "Não foi possível ler:",
                chave,
                erro
            );

        }

    }


    /*
     * Só migra fotos de fichas
     * que ainda existem atualmente
     * no Firestore.
     */
    const fichasAtuais =
        new Map(
            banco.fichas.map(
                ficha => [
                    String(ficha.id),
                    ficha
                ]
            )
        );


    const fotosParaMigrar =
        [
            ...fotosEncontradas.entries()
        ]
        .filter(
            ([id]) =>
                fichasAtuais.has(id)
        );


    if(
        fotosParaMigrar.length === 0
    ){

        alert(
            "Nenhuma foto antiga foi encontrada para migrar."
        );

        return;

    }


    const confirmar =
        confirm(
            "Foram encontradas " +
            fotosParaMigrar.length +
            " foto(s) antigas.\n\n" +
            "Deseja copiá-las para o Firestore?\n\n" +
            "O localStorage NÃO será apagado."
        );


    if(!confirmar){
        return;
    }


    const botao =
        document.getElementById(
            "migrar-fotos-firestore"
        );


    if(botao){

        botao.disabled =
            true;

        botao.textContent =
            "Migrando fotos...";

    }


    let migradas =
        0;


    const erros =
        [];


    try{

        for(
            const [
                id,
                fotoAntiga
            ]
            of fotosParaMigrar
        ){

            try{

                const fotoFinal =
                    await window
                        .prepararDataURLFotoFirestore(
                            fotoAntiga
                        );


                await db
                    .collection(
                        "fotosFichas"
                    )
                    .doc(id)
                    .set({

                        foto:
                            fotoFinal,

                        atualizadoEm:
                            firebase.firestore
                                .FieldValue
                                .serverTimestamp()

                    });


                const ficha =
                    fichasAtuais.get(
                        id
                    );


                if(ficha){

                    ficha.foto =
                        fotoFinal;

                }


                migradas++;


            }catch(erro){

                const ficha =
                    fichasAtuais.get(
                        id
                    );


                erros.push(
                    (
                        ficha?.personagem
                        ||
                        id
                    )
                    +
                    ": " +
                    erro.message
                );

            }

        }


        carregarFichaAtual();


        if(
            erros.length === 0
        ){

            alert(
                "Migração das fotos concluída!\n\n" +
                migradas +
                " foto(s) foram salvas no Firestore.\n\n" +
                "O localStorage continua intacto."
            );

        }else{

            alert(
                "Algumas fotos não puderam ser migradas.\n\n" +
                "Migradas: " +
                migradas +
                "\n" +
                "Erros: " +
                erros.length +
                "\n\n" +
                erros
                    .slice(0, 6)
                    .join("\n")
            );

        }


    }finally{

        if(botao){

            botao.disabled =
                false;

            botao.textContent =
                "Migrar fotos antigas";

        }

    }

}

const botaoMigrarFotos =
    document.getElementById(
        "migrar-fotos-firestore"
    );


if(botaoMigrarFotos){

    botaoMigrarFotos.addEventListener(
        "click",
        migrarFotosAntigasLocalStorage
    );

}


function atualizarBotaoMigrarFotos(){

    if(!botaoMigrarFotos){
        return;
    }


    botaoMigrarFotos.style.display =
        window.papelUsuario === "mestre"
        ? "block"
        : "none";

}


window.addEventListener(
    "usuario-autenticado",
    atualizarBotaoMigrarFotos
);


if(window.papelUsuario){

    atualizarBotaoMigrarFotos();

}