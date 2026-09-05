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
        
        if(
            qualidade > 0.50
        ){

            qualidade -=
                0.07;

        }else{
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
window.carregarFotosDasFichas = async function(fichas){
    if(!Array.isArray(fichas) || fichas.length === 0){
        return;
    }
    await Promise.all(fichas.map(async ficha => {
        try{
            const documento = await db.collection("fotosFichas").doc(String(ficha.id)).get();
            if(documento.exists){

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